const axios = require('axios')
require('dotenv').config()

const url = process.env.DATABASE_ENDPOINT


function resolve(intent) {
    switch (intent) {
        case 'database-get':
            break;
        case 'database-get':
            break;
        case 'database-get':
            break;
    }
}

function databaseGet() {
    axios.get(url)
}