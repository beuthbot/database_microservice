const axios = require('axios')
require('dotenv').config()

const url = process.env.DATABASE_ENDPOINT

/**
 * Takes the intent from the request body and resolves it into the correct database operation
 * for example: if the intent name is 'database-get', the database operation GET will be kicked off
 * @param {the whole request body} intent 
 */
function resolve(intent) {
    switch (intent.intent.name) {
        case 'database-get':
            return databaseGet(intent);
        case 'database-set':
            return databaseSet(intent);
        case 'database-remove':
            return databaseRemove(intent);
        default:
            return new Promise((resolve) => {
                resolve({ error: `Database Operation '${intent.intent.name}' does not exist` })
            })
    }
}

/**
 * GET operation on the database via REST to retrieve the details of a user
 * @param {the request body piped from the resolve function} data 
 */
function databaseGet(data) {
    const userTelegramID = data['user']['telegram-id']
    //const query = data['entities'][0]['value']
    //const queryUrl = query == 'alles' ? `${url}/${userTelegramID}/detail` : `${url}/${userTelegramID}/detail?q=${query}`

    return axios.get(`${url}/${userTelegramID}/detail`)
}

/**
 * The Database Set operation to set the user Details. Takes only the first entity from the entities array since it has the highes confidence score 
 * granted by rasa
 * @param {the request body piped from the resolve function} data 
 */
function databaseSet(data) {
    const userTelegramID = data['user']['telegram-id']

    return axios.post(`${url}/${userTelegramID}/detail`, {
        detail: data['entities'][0]['entity'],
        value: data['entities'][0]['value']
    })
}

/**
 * The Database Remove operation to remove Details of a user. Takes only the first entity from the entities array since it has the highes confidence score 
 * granted by rasa. If the entity 'alles' all the details of a user will be deleted
 * @param {the request body piped from the resolve function} data 
 */
function databaseRemove(data) {
    const userTelegramID = data['user']['telegram-id']

    const query = data['entities'][0]['value']

    const queryUrl = query == 'alles' ? `${url}/${userTelegramID}/detail` : `${url}/${userTelegramID}/detail?q=${query}`

    console.log(queryUrl)


    return axios.delete(queryUrl)
}

/**
 * exports only the resolve function, since it is the only one needed from outside the file
 */
module.exports = {
    resolve: resolve
}