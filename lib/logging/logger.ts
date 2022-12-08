import winston from "winston";
const { timestamp, combine, printf, cli } = winston.format;

const getLogLevel = () => {
  let givenLogLevel = process.env?.WARDEN_LOG_LEVEL || undefined;
  if (givenLogLevel) {
    if (givenLogLevel === "error") {
      return "error";
    } else if (givenLogLevel === "warn") {
      return "warn";
    } else if (givenLogLevel === "info") {
      return "info";
    } else if (givenLogLevel === "http") {
      return "http";
    } else if (givenLogLevel === "verbose") {
      return "verbose";
    } else if (givenLogLevel === "debug") {
      return "debug";
    } else if (givenLogLevel === "silly") {
      return "silly";
    } else {
      console.warn(
        `Warden: Invalid log level given: ${givenLogLevel}. Using default level (info)`
      );
      return "info";
    }
  } else {
    return "info";
  }
};

export const logger = winston.createLogger({
  level: getLogLevel(),
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
