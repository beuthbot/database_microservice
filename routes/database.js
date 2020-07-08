const express = require('express');
const router = express.Router();
const resolver = require('../services/intent-resolve')
const util = require('util')

router.post('/', function (req, res, next) {

    const message = req.body

    if (!message) {
        return createDefaultErrorAnswer("no message given")
    }

    resolver.resolve(req.body)
        .then(data => {
            console.debug("data:\n" + util.inspect(data, false, null, true))
            const answer = data.error ? data.error : data.data
            res.json(data)
            res.end()
        })
        .catch(exception => {
            res.send(exception)
        })
});

function createDefaultErrorAnswer(error) {
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

module.exports = router;
