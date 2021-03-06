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
            return await databaseGet(message);
        case 'database-set':
            return await databaseSet(message);
        case 'database-remove':
            return await databaseRemove(message);
        case 'link-user-get':
            return await triggerAccountRegister(message);
        case 'link-user-set':
            return await verifyAccountRegister(message);
        case 'link-user-remove':
            return await deleteAccount(message);
        default:
            return createErrorAnswer(
                "Das kann ich nicht.",
                `Database Operation '${intent.intent.name}' does not exist`
            )
    }
}

/**************************************************
 **************** database service ****************
 **************************************************/

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
        if (detailName && detailName !== "all-details") {

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
                    // filter register-code data
                    if(!String(key) === "code" || !String(key) === "code-timestamp" ){
                        userDetailsString += String(key) + ": **" + value + "**\n"
                    }
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

    console.debug("databaseResponse: " + util.inspect(databaseResponse, false, null, true))

    return createAnswer(`Ich habe das Detail '${detailName}' gelöscht.`)

}

/**************************************************
 **************** register service ****************
 **************************************************/

/**
 * function to start the registration process. generates and stores a code to register a different messenger to the current user account
 * @param message - incoming message
 * @returns answer with the generated code
 */
async function triggerAccountRegister(message){
    // check user
    if(!message.user || !message.user.id){
        return createErrorAnswer("Die Benutzerregistrierung konnte nicht gestartet werden","no user found in message")
    }
    // create code
    let code = generateCode()
    // safe code as detail with timestamp
    let userId = message.user.id
    let codeResponse = await axios.post(`${url}/users/register/code`,{
        id: userId,
        code: code,
        timestamp: Date.now()
    })
    // check answer
    if(codeResponse.data.ok === 1 && codeResponse.data.insertedCount === 1){
        return createAnswer("Der Verifizierungs-Code lautet: " + code + "\n Der Code gilt für die nächsten 15 Minuten.")
    } else if(codeResponse.retry){
        // if retry ist true, the generated code is already used AND active, so we retry the account registration
        return await triggerAccountRegister(message)
    } else if(!codeResponse.retry && !codeResponse.success){
        return createErrorAnswer("Die Benutzerregistrierung konnte nicht gestartet werden","no positive response from database")
    } else {
        return createErrorAnswer("Die Benutzerregistrierung konnte nicht gestartet werden","no response from database")
    }
}

/**
 * function to verify a user registration with a given code in the message
 * @param message - incoming message
 * @returns answer that indicates success or failure of registration
 */
async function verifyAccountRegister(message){
    // check user
    if(!message.user && !message.user.id){
        return createErrorAnswer("Die Benutzerverifizierung konnte nicht gestartet werden","no user found in message")
    }
    // get data from user message
    let entity = findEntity(message,"linkingcode")
    let userCode = entity.value
    let user = message.user

    if(!userCode){
        return createErrorAnswer("Es wurde kein Registrierungs-Code gefunden","no registration-code given")
    }
    // search code in user-database
    let userDetailsResponse = await axios.get(`${url}/users/register/code/${userCode}`)
    console.log(userDetailsResponse)
    if(userDetailsResponse.success && !userDetailsResponse.success){
        return createErrorAnswer("Der angegebene Registrierungs-Code ist falsch","wrong registration-code given")
    }
    // read register data from response
    let databaseCode = userDetailsResponse.data.code
    let databaseTimestamp = userDetailsResponse.data.time
    let databaseUserId = userDetailsResponse.data.userid
    // compare data
    // code expired after 15 minutes
    let timeoutTime = 900000
    if(parseInt(databaseCode) === parseInt(userCode) && (Date.now() - databaseTimestamp) < timeoutTime){
        // get linked/main user from database
        let mainUserResponse = await axios.get(`${url}/users/${databaseUserId}`)
        let mainUser = mainUserResponse.data
        // check if user from message has other accounts registered
        let userRegisterResponse
        if(user.messengerIDs.length > 1){
            // merge both users
            userRegisterResponse = await axios.post(`${url}/users/register/merge/`,{
                users: [mainUser,user]
            })
        } else {
            // register messenger to user
            userRegisterResponse = await axios.post(`${url}/users/register/`,{
                user: mainUser,
                accountData: {
                    messenger: user.messengerIDs[0].messenger,
                    id: user.messengerIDs[0].id
                }
            })
        }
        if(userRegisterResponse.data.ok === 1 && userRegisterResponse.data.nModified === 1){
            // delete beuthbot user from message
            let deleteResponse = await axios.delete(`${url}/users/${user.id}`)
            console.log(deleteResponse)
            return createAnswer("Deine Messenger wurden erfolgreich verbunden!")
        } else{
            return createErrorAnswer("Deine Messenger konnten nicht erfolgreich verbunden werden","negative register response")
        }
    } else {
        if(!databaseCode === userCode){
            console.log("A")
            return createErrorAnswer("Die eingegebene Code ist falsch","wrong registration-code given")
        } else {
            console.log("B")
            return createErrorAnswer("Der Code ist bereits abgelaufen, bitte starte die Registrierung erneut","code timeout")
        }
    }
}

/**
 * function to delete a given messenger account from the user
 * @param message - incoming message
 * @returns answer that indicates success or failure of account deletion
 */
async function deleteAccount(message){
    if(!message.user && !message.user.id){
        return createErrorAnswer("Das Löschen des Accounts konnte nicht gestartet werden","no user found in message")
    }
    // get data from message
    let user = message.user
    let messengerEntity = findEntity(message, "messenger")
    let messenger = messengerEntity.value.toLowerCase()
    // check messenger
    if(messenger){
        // delete messenger from user
        let deleteResult = await axios.delete(`${url}/users/register/`,{data: {
                user: user,
                messenger: messenger
            }})
        // check result
        if(deleteResult.data.ok === 1 && deleteResult.data.nModified === 1){
            return createAnswer("Dein Messenger wurden erfolgreich gelöscht!")
        } else {
            return createErrorAnswer("Dein Messenger konnte nicht erfolgreich gelöscht werden","delete result failed")
        }
    } else {
        return createErrorAnswer("Es wurde kein Messenger gefunden zum entfernen","no messenger given")
    }
}

/**************************************************
 **************** helper functions ****************
 **************************************************/

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
    // user can't have access to register-code data
    if (name === "code" || name === "code-timestamp") { return null }
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

function generateCode(){
    let numCode = ""
    while(numCode.length < 6){
        // generate number between 0 and 9
        let randomNum = Math.floor(Math.random() * 10)
        // append to existing number
        numCode += randomNum.toString()
    }
    return numCode
}
/**
 * exports only the resolve function, since it is the only one needed from outside the file
 */
module.exports = {
    resolve: resolve
}