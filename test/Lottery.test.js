const assert = require('assert');
const ganache = require('ganache-cli');

const Web3 = require('web3');

const web3 = new Web3(ganache.provider());

const { interface, bytecode } = require('../compile');

let accounts;
let lottery;


beforeEach(async () => {

  accounts = await web3.eth.getAccounts();

  lottery = await new web3.eth.Contract(JSON.parse(interface))
    .deploy({ data: bytecode })
    .send({ from: accounts[0], gas: '1000000' });
});


describe('Lottery', () => {
  it('Deploys contract', () => {
    assert.ok(lottery.options.address);
  });

  it('Sets correct manager', async () => {
    assert.equal(accounts[0], await lottery.methods.manager().call());
  });
  it('Accepts players', async () => {
    await lottery.methods.enter().send({
      from: accounts[0],
      value: web3.utils.toWei('0.03', 'ether'),
      gas: '1000000'
    });

    const players = await lottery.methods.getPlayers().call({
      from: accounts[0]
    });

    assert.equal(accounts[0], players[0]);
    assert.equal(1, players.length);

  });

  it('Accepts several players', async () => {
    await lottery.methods.enter().send({
      from: accounts[0],
      value: web3.utils.toWei('0.03', 'ether'),
      gas: '1000000'
    });
    await lottery.methods.enter().send({
      from: accounts[1],
      value: web3.utils.toWei('0.04', 'ether'),
      gas: '1000000'
    });
    await lottery.methods.enter().send({
      from: accounts[2],
      value: web3.utils.toWei('0.05', 'ether'),
      gas: '1000000'
    });

    const players = await lottery.methods.getPlayers().call({
      from: accounts[0]
    });

    assert.equal(accounts[0], players[0]);
    assert.equal(accounts[1], players[1]);
    assert.equal(accounts[2], players[2]);
    assert.equal(3, players.length);

  });

  it('Deposits correct amount to prizepool and contract funds', async () => {
    await lottery.methods.enter().send({
      from: accounts[0],
      value: web3.utils.toWei('0.03', 'ether'),
      gas: '1000000'
    });

    const prizePool = await lottery.methods.prizePool().call({
      from: accounts[0]
    });
    const contractFunds = await lottery.methods.contractFunds().call({
      from: accounts[0]
    });

    assert.equal(web3.utils.toWei('0.02', 'ether'), prizePool);
    assert.equal(web3.utils.toWei('0.01', 'ether'), contractFunds);

  });

  it('Rejects when deposit is too low', async () => {
    try{
      await lottery.methods.enter().send({
        from: accounts[0],
        value: web3.utils.toWei('0.01', 'ether'),
        gas: '1000000'
      });
      assert(false);
    } catch (err) {
      assert(err);
    }
  });

  it('Does not let randoms pick winner', async () => {

    await lottery.methods.enter().send({
      from: accounts[0],
      value: web3.utils.toWei('0.03', 'ether'),
      gas: '1000000'
    });

    try{
      await lottery.methods.pickWinner().send({
        from: accounts[1]
      });
      assert(false);
    } catch (err) {
      assert(err);
    }
  });
  it('Pick winner, sends prize and resets contract', async () => {
    await lottery.methods.enter().send({
      from: accounts[0],
      value: web3.utils.toWei('0.03', 'ether'),
      gas: '1000000'
    });

    const balanceBefore = await web3.eth.getBalance(accounts[0]);

    await lottery.methods.pickWinner().send({
      from: accounts[0]
    });

    const balanceAfter = await web3.eth.getBalance(accounts[0]);
    const difference = balanceAfter - balanceBefore;

    const players = await lottery.methods.getPlayers().call({
      from: accounts[0]
    });

    assert.equal(0, players.length);
    assert(difference > web3.utils.toWei('0.018', 'ether'));


  });
  it('Does not send the contract funds to winner', async () => {
    await lottery.methods.enter().send({
      from: accounts[0],
      value: web3.utils.toWei('0.03', 'ether'),
      gas: '1000000'
    });

    const balanceBefore = await lottery.methods.contractFunds().call({
      from: accounts[0]
    });

    await lottery.methods.pickWinner().send({
      from: accounts[0]
    });

    const balanceAfter = await lottery.methods.contractFunds().call({
      from: accounts[0]
    });

    assert.equal(balanceBefore, balanceAfter);
  });
  it('Withdraws funds when manager requests', async () => {
    await lottery.methods.enter().send({
      from: accounts[0],
      value: web3.utils.toWei('0.03', 'ether'),
      gas: '1000000'
    });

    const balanceBefore = await web3.eth.getBalance(accounts[1]);

    await lottery.methods.withdrawFunds(accounts[1]).send({
      from: accounts[0]
    });

    const balanceAfter = await web3.eth.getBalance(accounts[1]);
    const difference = balanceAfter - balanceBefore;

    assert.equal(web3.utils.toWei('0.01', 'ether'), difference);

  });
  it('Does not let random addresses withdraw funds', async () => {
    await lottery.methods.enter().send({
      from: accounts[0],
      value: web3.utils.toWei('0.03', 'ether'),
      gas: '1000000'
    });

    try{
      await lottery.methods.withdrawFunds(accounts[1]).send({
        from: accounts[1]
      });
    } catch (err) {
      assert(err);
      return;
    }
    assert(false);
  });
});
