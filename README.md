# Warden

Warden is a module designed to schedule and repeat jobs with a persistence layer backed by SQL (currently only MySQL is configured).

This module is in its very early stages and will be updated to add more functionality such as compatibility with other SQL database types.

## Installation

This package can be installed through NPM.

```bash
npm install task-warden
```

## Usage

The SQL connection is made possible through the module [Sequelize](https://www.npmjs.com/package/sequelize).

```javascript
// ES5 via require statement
const { Warden, Process } = require("task-warden");

// ES6 via import statement
import { Warden, Process } from "task-warden";

// Create instance of Warden
const warden = new Warden({
  db: {
    name: "test",
    host: "12.345.67.89",
    username: "foo",
    password: "bar",
    port: 3306,
    logging: false,
  },
  frequency: 300000,
  maxConcurrent: 10,
});

// Initiate the database connection. If table does not exists, it will be created.
await warden.init();

// Create a new Process via warden.createProcess(processName, function, options)
let process1 = warden.createProcess("test1", () => console.log("test1"), {
  maxWorkers: 5,
  lockLifetime: 60000,
});

// Schedule the process to run at specific time
await warden.schedule(process1, {}, { runAt: new Date() });

// Start Warden
// Frequency can be defined either here or when creating a new Warden instance.
await warden.start({ frequency: 300000 });

//Stop Warden from executing any further tasks.
await warden.stop();
```

## Warden

### Database

_db.name_: Name of the database to be used.

_db.host_: IP Address of the database or localhost.

_db.username_: User to sign into the database with.

_db.password_: Password to sign into database with.

_db.port_: Port number of the database, defaults to 3306. _Optional_

_db.logging_: Whether or not [Sequelize](https://www.npmjs.com/package/sequelize). should log database calls. Defaults to false. _Optional_

### Other Options

_frequency_: How often Warden should check the database for new tasks. _Optional_

_maxConncurrent_: How many jobs should be allowed to run at the same time. _Optional_

## Process

### Parameters

_processName_: Custom name for the process. Used to identify jobs for that process in the database.

_function_: The function to execute when a job for this process runs.

### Options

_maxWorkers_: Maximum number of workers to execute tasks for a process. Default is 5. _Optional_

_lockLifetime_: How long warden should wait to try to re-fetch a job and try again. Default is 60000(ms). _Optional_

## Scheduling

NOTE: If no options are passed for scheduling, the task will execute immediately.

It is possible to set both the `cron` and `runAt` values. If done, the `cron` info will be used for calculating future jobs and the `runAt` value when be when the first job runs. This can be useful for scheduling weekly or monthly tasks that you would like to execute the first job early on.

### Parameters

_process_: A process object returned from the `createProcess` function.

_data_: Any data to be passed to the function defined in the process to be executed.

### Options

_runAt_: A JavaScript date that the job should run at. _Optional_

_cron_: A cron string defining how when the job should run. _Optional_

## Contributing

Contribution is welcome. Please create an issue before any pull requests are added.

## License

[MIT](https://choosealicense.com/licenses/mit/)
