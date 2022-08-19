import winston from "winston";
const { timestamp, combine, printf, cli } = winston.format;

export const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: combine(
        timestamp({ format: "YYYY-MM-DD HH:mm:ss:SSS" }),
        cli(),
        printf((info) => {
          return `${info.timestamp} ${info.level} ${info.message}`;
        })
      ),
    }),
  ],
});
