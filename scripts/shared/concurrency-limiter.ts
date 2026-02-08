/**
 * Limits the number of concurrent promises executing at once using a semaphore pattern
 *
 * @remarks
 * Useful for controlling resource usage when spawning Docker containers or making API calls.
 * Tasks are executed as soon as slots become available, maintaining the specified concurrency limit.
 *
 * @param tasks - Array of functions that return promises to execute
 * @param limit - Maximum number of tasks to run concurrently (0 or Infinity for unbounded)
 * @returns Promise that resolves with array of all task results in original order
 *
 * @public
 */
export const limitConcurrency = async <T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> => {
  // Handle unbounded parallelism
  if (limit === 0 || limit === Infinity || limit >= tasks.length) {
    return Promise.all(tasks.map((task) => task()));
  }

  const results: T[] = [];
  const executing: Promise<void>[] = [];
  let index = 0;

  for (const task of tasks) {
    const taskIndex = index++;
    const promise = task().then((result) => {
      results[taskIndex] = result;
    });

    const wrapped = promise.then(() => {
      executing.splice(executing.indexOf(wrapped), 1);
    });
    executing.push(wrapped);

    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
};
