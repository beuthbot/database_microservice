var express = require('express');
var router = express.Router();
const resolver = require('../services/intent-resolve')

router.post('/', function (req, res, next) {
  resolver.resolve(req.body)
    .then(data => {
      const answer = data.error ? data.error : data.data
      res.send(answer)
    })
    .catch(exception => {
      res.send(exception)
    })
});

module.exports = router;
