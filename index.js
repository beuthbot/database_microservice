const indexRouter = require('./routes/database');

const {Service, AppConfig} = require('@bhtbot/bhtbotservice');

/* Init Service */
const config = new AppConfig();
config.port = process.env.PORT ? Number(process.env.PORT) : 27016;
const app = new Service('database_microservice', config);

app.endpoint('database', indexRouter);
app.endpoint('resolve', indexRouter);

app.start();





