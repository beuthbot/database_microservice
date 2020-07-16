const axios = require('axios')
require('dotenv').config()

const util = require('util')

const url = process.env.DATABASE_ENDPOINT

/**
 * Takes the intent from the request body and resolves it into the correct database operation
 * for example: if the intent name is 'database-get', the database operation GET will be kicked off
 * @param {the whole request body} intent 
 */
async function resolve(intent) {

    console.debug("resolve:\n" + util.inspect(intent, false, null, true))

    let message = intent.message
    if (!message) {
        return createDefaultErrorAnswer("no message found")
    }

    if (!message.intent) {
        return createDefaultErrorAnswer("no intent found")
    }

    if (!message.intent.name) {
        return createDefaultErrorAnswer("intent has no name")
    }

    console.debug("intent-name: " + message.intent.name)

    switch (message.intent.name) {
        case 'database-get':
            return databaseGet(message);
        case 'database-set':
            return databaseSet(message);
        case 'database-remove':
            return databaseRemove(message);
        default:
            return createErrorAnswer(
                "Das kann ich nicht.",
                `Database Operation '${intent.intent.name}' does not exist`
            )
    }
}

/**
 * GET operation on the database via REST to retrieve the details of a user
 * @param {the request body piped from the resolve function} data 
 */
async function databaseGet(message) {
    const beuthBotID = getBeuthBotID(message)
    console.debug("beuthBotID: " + beuthBotID)

    let userDetailsResponse = await axios.get(`${url}/users/${beuthBotID}/detail`)
    let user = userDetailsResponse.data

    console.debug("user:\n" + util.inspect(user, false, null, true))

    if (user) {

        const detailEntity = findDetailsEntity(message)
        if (!detailEntity) {
            return createDefaultErrorAnswer("can't find detail entity")
        }

        let detailName = detailEntity.entity
        if (detailName) {

            // the name of the entity will always have "detail-" prefix
            detailName = detailName.replace("detail-", "")

            if (user.details) {
                let valueCandidate = user.details[detailName]
                if (valueCandidate) {
                    return createAnswer(valueCandidate)
                } else {
                    return createErrorAnswer(
                        "Das kann ich nicht finden.",
                        `No detail with name '${detailName}'`
                    )
                }

            } else {
                return createDefaultErrorAnswer("invalid user")
            }

        } else {

            let userDetailsString = "Deine Daten:\n\n"

            if (user.nickname) { userDetailsString += "Nickname: **" + user.nickname + "**\n" }
            if (user.firstName) { userDetailsString += "Vorname: **" + user.firstName + "**\n" }
            if (user.lastName) { userDetailsString += "Nachname: **" + user.lastName + "**\n" }
            userDetailsString += "\n"

            if (user.details) {
                for (const [ key, value ] of Object.entries(user.details)) {
                    userDetailsString += String(key) + ": **" + value + "**\n"
                }
            }

            return createAnswer(userDetailsString)
        }
    } else {
        return createErrorAnswer(
            "Das kann ich nicht finden.",
            `No details for user with id: '${beuthBotID}'`
        )
    }
}

/**
 * The Database Set operation to set the user Details. Takes only the first entity from the entities array since it has
 * the highes confidence score granted by rasa
 * @param {the request body piped from the resolve function} data 
 */
async function databaseSet(message) {

    const beuthBotID = getBeuthBotID(message)
    if (!beuthBotID) {
        return createDefaultErrorAnswer("can't find user id in message")
    }

    const detailEntity = findDetailsEntity(message)
    if (!detailEntity) {
        return createDefaultErrorAnswer("can't find detail entity")
    }

    let detailName = detailEntity.entity
    if (!detailName) {
        return createDefaultErrorAnswer("can't find detail name")
    }

    if (detailName === "all-details") {
        return createDefaultErrorAnswer("can't set all-details")
    }


    // the name of the entity will always have "detail-" prefix
    detailName = detailName.replace("detail-", "")
    console.debug("detailName: " + detailName)

    var detailValueEntity = null
    switch (detailName) {
        case 'home':
            detailValueEntity = findEntity(message, "city")
            break
        case 'birthday':
            detailValueEntity = findEntity(message, "time")
            break
        case 'meal-preference':
            detailValueEntity = findEntity(message, "meal-preference")
            break
        case 'allergic':
            detailValueEntity = findEntity(message, "allergen")
            break
        default:
            detailValueEntity = findEntity(message, detailName)
            break
    }

    if (!detailValueEntity) {
        return createErrorAnswer(
            `Ich habe kein Detail für '${detailName}' in der Nachricht gefunden.`,
            `unknown detail name: '${detailName}'`
        )
    }

    const detailValue = detailValueEntity.value
    if (!detailValue) {
        return createErrorAnswer(
            `Ich habe kein Detail für '${detailName}' in der Nachricht gefunden.`,
            `unknown detail name: '${detailName}'`
        )
    }

    console.debug("detailValueEntity: " + detailValueEntity)
    console.debug("detailValue: " + detailValue)

    let databseResponse = await axios.post(`${url}/users/${beuthBotID}/detail`, {
        detail: detailName,
        value: detailValue
    })

    if (!databseResponse) {
        return createDefaultErrorAnswer("no response from database")
    }

    console.debug("databseResponse: " + util.inspect(databseResponse, false, null, true))

    return createAnswer("Das habe ich mir gemerkt.")
}

/**
 * The Database Remove operation to remove Details of a user. Takes only the first entity from the entities array since
 * it has the highes confidence score granted by rasa. If the entity 'alles' all the details of a user will be deleted
 * @param {the request body piped from the resolve function} data 
 */
async function databaseRemove(message) {

    const beuthBotID = getBeuthBotID(message)
    if (!beuthBotID) {
        return createDefaultErrorAnswer("can't find user id in message")
    }

    const detailEntity = findDetailsEntity(message)
    if (!detailEntity) {
        return createDefaultErrorAnswer("can't find detail entity")
    }

    let detailName = detailEntity.entity
    if (!detailName) {
        return createDefaultErrorAnswer("can't find detail name")
    }

    if (detailName === "all-details") {
        await axios.delete(`${url}/users/${beuthBotID}/detail`)
        return createAnswer(`Ich habe alle Details gelöscht.`)
    }

    // the name of the entity will always have "detail-" prefix
    detailName = detailName.replace("detail-", "")
    console.debug("detailName: " + detailName)

    const databaseResponse = axios.delete(`${url}/users/${beuthBotID}/detail?q=${detailName}`)

    if (!databaseResponse) {
        return createDefaultErrorAnswer("no response from database")
    }

    console.debug("databseResponse: " + util.inspect(databaseResponse, false, null, true))

    return createAnswer(`Ich habe das Detail '${detailName}' gelöscht.`)

}

function createAnswer(text) {
    return new Promise((resolve) => {
        resolve({
            answer: {
                content: text,
                history: ["intent-resolve"]
            }
        })
    })
}

function createErrorAnswer(text, error) {
    console.debug("createErrorAnswer: " + error)
    return new Promise((resolve) => {
        resolve({
            error: error,
            answer: {
                content: text,
                history: ["intent-resolve"]
            }
        })
    })
}

function createDefaultErrorAnswer(error) {
    console.debug("createDefaultErrorAnswer: " + error)
    return new Promise((resolve) => {
        resolve({
            error: error,
            answer: {
                content: "Das kann ich irgendwie nicht.",
                history: ["intent-resolve"]
            }
        })
    })
}

function getBeuthBotID(message) {
    if (!message || !message.user || !message.user.id) { return null }
    return message.user.id
}

function findEntity(message, name) {
    if (!message.entities) { return null }
    if (!message.entities.length) { return null }
    for (let i = 0; i < message.entities.length; i++) {
        let entity = message.entities[i]
        if (entity.entity === name) { return entity }
    }
}

function findDetailsEntity(message) {
    if (!message.entities) { return null }
    if (!message.entities.length) { return null }
    for (let i = 0; i < message.entities.length; i++) {
        let entity = message.entities[i]
        let entityName = entity.entity
        if (entityName) {
            if (entityName.startsWith("detail")) {
                return entity
            } else if (entityName === "all-details") {
                return entity
            }
        }
    }
}

/**
 * exports only the resolve function, since it is the only one needed from outside the file
 */
module.exports = {
    resolve: resolve
}