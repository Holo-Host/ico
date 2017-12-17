require('babel-register');
require('babel-polyfill');

module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*", // Match any network id
      gas: 4500000
    },
    rinkeby: {
      host: "localhost", // Connect to geth on the specified
      port: 8545,
      from: "0xE2652f6128A05cd270F6719bdee0867a81f346Ca", // default address to use for any transaction Truffle makes during migrations
      network_id: 4,
      gas: 6512388, // Gas limit used for deploys
      gasPrice: 5000000000
    }
  }
};
