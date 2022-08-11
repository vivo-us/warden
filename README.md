# Warden

Warden is a module designed to schedule and repeat jobs with a persistence layer backed by SQL (currently only MySQL is configured).

This module is in its very early stages and will be updated to add more functionality such as compatibility with other SQL database types.

The ability for the module to retry a job has been added in version 2.0.0. To migrate to this new version, a new column must be added to the database title "numberOfRetries" with a datatype of INT(11) and a default value of 0. This is a breaking change and it will not work with previous database tables unless they are migrated to the new schema.

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
    host: "123.45.67.89",
    username: "foo",
    password: "bar",
    port: 3306,
    logging: false,
  },
  frequency: 300000,
  maxConcurrent: 10,
});

// Create a new Process via warden.createProcess(processName, function, options)
let process1 = warden.createProcess("test1", () => console.log("test1"), {
  maxWorkers: 5,
  lockLifetime: 60000,
  maxRetries: 3,
});

// Start Warden
// Frequency can be defined either here or when creating a new Warden instance.
await warden.start({ frequency: 300000 });

// Schedule the process to run at specific time
await warden.schedule(process1, {}, { runAt: new Date() });

// Update a Job
await warden.updateJob(123, { data: "test1" });

// Cancel a Job
await warden.cancelJob(123);

//Stop Warden from executing any further tasks.
await warden.stop();
```

## Warden Constructor Options

The constructor will automatically initiate a database connection and create a `job` table if one does not exist. Once initiated, it will emit a `db-initialized` event, which the `start()` event automatically handles and waits for. You may listen for this event and others on `warden.emitter`.

### Database

_db.name_ : Name of the database to be used.\
_db.host_ : IP Address of the database or localhost.\
_db.username_ : User to sign into the database with.\
_db.password_ : Password to sign into database with.\
_db.port_ : Port number of the database. Defaults to `3306`. _Optional_\
_db.logging_ : Whether or not [Sequelize](https://www.npmjs.com/package/sequelize) should log database calls. Defaults to `false`. _Optional_

### Other Options

_frequency_ : How often Warden should check the database for new tasks. _Optional_\
_maxConcurrent_ : How many jobs should be allowed to run at the same time. _Optional_
_timezone_ : Timezone to use for parsing cron expressions. Defaults to `"UTC"`. _Optional_

## Controlling Warden

### start(options)

The `start()` method must be called before any process can be scheduled or executed.
Have the warden start processing jobs base on the frequency entered when the warden was created, the value passed in the options here, or the default of `300000`(ms).

_options.frequency_ : Number of ms between each fetch from the database.

### stop()

When called, `Warden` will no longer fetch new jobs and all jobs are removed from the queue. Any jobs that are currently running will still be completed.

## Defining Processes

You may define a process either directly on the `warden` object with `createProcess()` or by creating a process with `new Process` and using the `assign()` method to assign it the warden.

It is worth noting that if you would like an instance of warden to only schedule tasks in the database but not run them, you can do so by passing `0` to the `maxWorkers` option.

### createProcess(name, function, options)

_name_ : Custom name for the process. Used to identify jobs for that process in the database.\
_function_ : The function to execute when a job for this process runs.\
_options.maxWorkers_ : Maximum number of workers to execute tasks for a process. Defaults to `5`. _Optional_\
_options.maxRetries : Maximum number of times to retry a process. Defaults to `0`. \_Optional_\
_options.lockLifetime_ : How long warden should wait to try to re-fetch a job and try again. Defaults to `60000`(ms). _Optional_

Returns a `process` object.

### new Process(name, function, options)

The parameters and options are the same as `createProcess()` above.

Returns a `process` object.

### assign(process)

_process_ : A `process` object either created with `new Process` or the `createProcess()` method.\
_name_ : Custom name for the process. Used to identify jobs for that process in the database.\
_function_ : The function to execute when a job for this process runs.\
_options.maxWorkers_ : Maximum number of workers to execute tasks for a process. Defaults to `5`. _Optional_\
_options.lockLifetime_ : How long warden should wait to try to re-fetch a job and try again. Defaults to `60000`(ms). _Optional_

## Scheduling Jobs

NOTE: If no options are passed for scheduling, the task will execute immediately.

### schedule(process, data, options)

It is possible to set both the `cron` and `runAt` values. If done, the `cron` info will be used for calculating future jobs and the `runAt` value when be when the first job runs. This can be useful for scheduling weekly or monthly tasks that you would like to execute the first job early on.

_process_ : A process object returned from the `createProcess` function.\
_data_ : Any data to be passed to the function defined in the process to be executed.\
_options.runAt_ : A JavaScript date that the job should run at. _Optional_\
_options.cron_ : A cron string defining how when the job should run. _Optional_

## Fetching Jobs

If you would like to retrieve jobs from the database, you can use the below method.

### getJobs(options)

By default, all jobs that are either created, pending, or running are returned. The below filters can be used as well.

_options.jobId_ : Id of the job you would like returned. _Optional_\
_options.processName_ : Name of the process you would like jobs returned for. _Optional_\
_options.status_ : Job status(es) you would like returned jobs to match. Defaults to `["created", "pending", "running"]` _Optional_

Returns an array of `job` objects.

## Updating Jobs

### updateJob(jobId, options)

NOTE: If both `cron` and `nextRunAt` options are passed, the job will run next at the date specified by `nextRunAt`, and then all future executions will be determined by the `cron` string.

_jobId_ : Id of the job you would like to cancel.
_options.cron_ : A cron string for recurring jobs. _Optional_
_options.data_: Data that the job will pass to the process being executed. _Optional_
_options.nextRunAt_ : A date object representing when the next job should run at. _Optional_

## Cancelling Jobs

### cancelJob(jobId)

Removes the job from the queue and changes the status of the job in the database to `cancelled`.

_jobId_ : Id of the job you would like to cancel.

## Contributing

Contribution is welcome. Please create an issue before any pull requests are added.

## License

[MIT](https://choosealicense.com/licenses/mit/)
