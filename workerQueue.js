import { get, size, find, remove } from '../lodash/'

export class Worker {
  id: string;
  operation: string;
  action: Function;
  parameter: Array;

  constructor(id: string, operation: string, action: Function, parameter: Array) {
    this.id = id;
    this.operation = operation;
    this.action = action;
    this.parameter = parameter;
  }
}

export class WorkerQueue {
  workerQueue = [];

  constructor() {
    this.addWorker = this.addWorker.bind(this);
    this.deleteWorker = this.deleteWorker.bind(this);
  }

  deleteWorker(worker: Worker) {
    remove(this.workerQueue, (currentWorker) => {
      return currentWorker.id === worker.id && currentWorker.operation === worker.operation;
    });
  }

  addWorker(worker: Worker) {
    const storedWorkerThatDoesTheSame = find(this.workerQueue, (currentWorker) => {
      return currentWorker.id === worker.id && currentWorker.operation === worker.operation;
    });

    if (storedWorkerThatDoesTheSame === undefined) {
      console.log('>> '+worker.operation+' '+worker.id);
      // -- no worker there.. add this one!
      // worker.operation = worker.operation.then(() => { this.deleteWorker(worker); return arguments; });
      const that = this;

      worker.action = new Promise(function(resolve, reject) {
        try {
          const returnValues = worker.action.apply(that, worker.parameter);
          resolve(returnValues);
        } catch(err) {
          reject(returnValues);
        } finally {
          that.deleteWorker(worker);
        }
      });

      this.workerQueue.push(worker);
      return worker.action;
    }
    console.log('!! '+storedWorkerThatDoesTheSame.operation+' '+storedWorkerThatDoesTheSame.id);
    return new Promise((resolve, reject) => { reject('already a worker doing that it'); });
  }
}