const MAX_CONCURRENT_PIPELINE_JOBS = Number(process.env.PIPELINE_MAX_CONCURRENT_JOBS || 10);

let active = 0;
const waiters = [];

export const getConcurrencyStats = () => ({
  active,
  queued: waiters.length,
  max: MAX_CONCURRENT_PIPELINE_JOBS,
});

const acquire = () => {
  if (active < MAX_CONCURRENT_PIPELINE_JOBS) {
    active += 1;
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    waiters.push(resolve);
  });
};

const release = () => {
  const next = waiters.shift();
  if (next) {
    next();
    return;
  }

  active = Math.max(0, active - 1);
};

export const runGated = async (task) => {
  await acquire();
  try {
    return await task();
  } finally {
    release();
  }
};

export { MAX_CONCURRENT_PIPELINE_JOBS };
