export default (argv, src, dst) => {
  if (src.id === dst.id) return false; // do not create a task against itself, ignore

  if (argv.oneWay === true) {
    /* Scenarios:
       #1: --config a --storage a b
        Here we're performing 1 task between storage a and b
       #2: --config a b --storage a
        Here we're performing 1 task between config a and b
       #3: --config a b --storage a b
        Here we're performing 2 tasks between config a and storage a & b, and config b and storage a & b
    */
    if (src.storage.id !== argv.storage[0]) return false; // do not create tasks for more than one source storage
    if (src.config.id !== argv.config[0]) return false; // do not create tasks for more than one source config
  }

  return true;
}
