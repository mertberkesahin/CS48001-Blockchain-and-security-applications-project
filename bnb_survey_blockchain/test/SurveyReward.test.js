const { assert } = require("chai"); //in order to use 'assert' etc.

require("chai")
  .use(require("chai-as-promised"))
  .should();
const SurveyReward = artifacts.require("./SurveyReward.sol");

contract("SurveyReward", ([conductor, participant, participant2]) => {
  //all the accounts that are taken from GANACHE
  //account 1 = conductor/us, account 2 = participant 1, account 3 = participant 2
  let surveyReward;
  //store the deployed smart contract in this variable 'surveyReward'.
  before(async () => {
    surveyReward = await SurveyReward.deployed();
  });

  describe("deployment", async () => {
    //we can only use await by using async. Deployed is async function it's in the blockchain takes a long time.
    it("Successfully deployed", async () => {
      const address = await surveyReward.address; //getting the adress
      assert.notEqual(address, 0x0); //making sure it's present
      assert.notEqual(address, "");
      assert.notEqual(address, null);
      assert.notEqual(address, undefined);
    });
    it("Ready to open frontend", async () => {
      const appName = await surveyReward.name();
      const surveyCount = await surveyReward.surveyCount();
      assert.equal(
        appName,
        "Survey Rewarding System by BNB",
        "Application name is correct"
      );
      assert.equal(surveyCount, 0, "Initial survey count is 0");
    });
  });

  describe("open surveys", async () => {
    let result;
    let surveyCount;
    before(async () => {
      result = await surveyReward.createSurvey
      (
        "Reward System",
        400,
        "A detailed description",
        [web3.utils.asciiToHex("Question 1")],
        {
          from: conductor,
          value: 400,
        }
        //We call the create  functions in SurveyReward.sol
      );
      surveyCount = await surveyReward.surveyCount();
    });
    it("creates surveys", async () => {
      // POSITIVE CASE
      assert.equal(surveyCount, 1, "Survey count is incremented");
      console.log(result.logs) //TEST İÇİN YAPTIM ÇALIŞTIRIRKEN COMMAND ATABİLİRİZ!
      const event = result.logs[0].args;
      assert.equal(event.title, 'Reward System', 'Survey title is accurate')
      assert.equal(
        event.questionCount.toNumber(),
        2,
        "Question count is correct"
      );
      assert.equal(event.conductor, conductor, "Survey conductor is correct");
      assert.equal(event.open, true, "Survey status is correct");
      assert.equal(event.reward.toNumber(), 400, "Survey reward is correct");
      assert.equal(
        event.description,
        "A detailed description",
        "Survey description is correct"
      );

      // NEGATIVE CASE
      await surveyReward.createSurvey("", 400, {
        from: conductor,
        value: 400,
      }).should.be.rejected;
      await surveyReward.createSurvey("Invalid reward", 400, {
        from: conductor,
        value: 200,
      }).should.be.rejected;
      await surveyReward.createSurvey(
        "Reward System",
        400,
        "A detailed description",
        [],
        {
          from: conductor,
          value: 400,
        }
      ).should.be.rejected;
    });

    it("gets surveys", async () => {
      // POSITIVE CASE
      //Fetch the surveys from the blockchain from the smart contract
      const survey = await surveyReward.surveys(0);
      assert.equal(survey.title, "Reward System", "Title is correct");
      assert.equal(
        survey.questionCount.toNumber(),
        2,
        "Question count is correct"
      );
      assert.equal(survey.conductor, conductor, "Conductor is correct");
      assert.equal(survey.open, true, "Status is correct");
      assert.equal(survey.reward.toNumber(), 400, "Reward is correct");
      assert.equal(survey.balance.toNumber(), 400, "Balance is correct");
    });

    it("verifies captcha", async () => {
      let prevBalance = await web3.eth.getBalance(surveyReward.address);
      prevBalance = new web3.utils.BN(prevBalance);

      result = await surveyReward.answerQuestion(
        0,
        0,
        web3.utils.asciiToHex("I am not using a bot"),
        { from: participant, value: 200 }
      );
      const event = result.logs[0].args;
      assert.equal(event.surveyid.toNumber(), 0, "Survey id is correct");
      assert.equal(event.questionid.toNumber(), 0, "Question id is correct");
      assert.equal(event.participant, participant, "Participant is correct");
      assert.equal(event.open, true, "Survey status is correct");
      assert.equal(
        web3.utils.hexToAscii(event.answer).replace(/\0/g, ""),
        "I am not using a bot",
        "Answer is correct"
      );

      let afterBalance = await web3.eth.getBalance(surveyReward.address);
      afterBalance = new web3.utils.BN(afterBalance);

      let price = new web3.utils.BN(200);
      const expectedBalance = prevBalance.add(price);

      assert.equal(
        expectedBalance.toString(),
        afterBalance.toString(),
        "Initial price is received"
      );

      // NEGATIVE CASES
      await surveyReward.answerQuestion(
        1,
        0,
        web3.utils.asciiToHex("I am not using a bot"),
        { from: participant2 }
      ).should.be.rejected;
      await surveyReward.answerQuestion(
        0,
        5,
        web3.utils.asciiToHex("I am not using a bot"),
        { from: participant2 }
      ).should.be.rejected;
      await surveyReward.answerQuestion(
        1,
        5,
        web3.utils.asciiToHex("I am not using a bot"),
        { from: participant2 }
      ).should.be.rejected;
      await surveyReward.answerQuestion(
        0,
        1,
        web3.utils.asciiToHex("I am not using a bot"),
        { from: participant2 }
      ).should.be.rejected;
    });

    it("gets checkpoints", async () => {
      result = await surveyReward.getCheckpoint(0, { from: participant });
      assert.equal(result.toNumber(), 1, "Checkpoint is correct");
      result = await surveyReward.getCheckpoint(0, { from: participant2 });
      assert.equal(result.toNumber(), 0, "Checkpoint is correct");

      // NEGATIVE CASES
      await surveyReward.getCheckpoint(1, { from: participant }).should.be
        .rejected;
    });

    it("answers questions", async () => {
      //Önceden kaç parası olduğunu kontrol et
      let prevBalance
      prevBalance = await web3.eth.getBalance(surveyReward.address);
      prevBalance = new web3.utils.BN(prevBalance);
      //SUCCESS:
      result = await surveyReward.answerQuestion(
        0,
        1,
        web3.utils.asciiToHex("An answer on blockchain"),
        { from: participant }
      );
      //Check logs
      const event = result.logs[0].args;
      assert.equal(event.surveyid.toNumber(), 0, "Survey id is correct");
      assert.equal(event.questionid.toNumber(), 1, "Question id is correct");
      assert.equal(event.participant, participant, "Participant is correct");
      assert.equal(event.open, false, "Survey status is correct");
      assert.equal(
        web3.utils.hexToAscii(event.answer).replace(/\0/g, ""),
        "An answer on blockchain",
        "Answer is correct"
      );

      //Kullanıcının parayı aldığını check et burda
      //Önceden ne kadar parası olduğuna ve sonradan ne kadar parası olduğuna bak
      //Farkını al. Eğer reward price ımız kadarsa doğrudur.
      let afterBalance  
      afterBalance = await web3.eth.getBalance(surveyReward.address);
      afterBalance = new web3.utils.BN(afterBalance);
      let price  
      price = new web3.utils.BN(400);
      const expectedBalance = afterBalance.add(price);
      
      //As a result We have seen that participant receives the money 
      //whenever the survey filled in surveyreward
      assert.equal(
        expectedBalance.toString(),
        prevBalance.toString(),
        "Reward price is transfered"
      );

      // NEGATIVE TEST CASES
      await surveyReward.answerQuestion(1, 0, "An answer on blockchain", {
        from: participant,
      }).should.be.rejected;

      await surveyReward.answerQuestion(0, 5, "An answer on blockchain", {
        from: participant,
      }).should.be.rejected;

      await surveyReward.answerQuestion(1, 5, "An answer on blockchain", {
        from: participant,
      }).should.be.rejected;

      await surveyReward.answerQuestion(0, 0, "An answer on blockchain", {
        from: conductor,
      }).should.be.rejected;

      await surveyReward.answerQuestion(
        0,
        0,
        web3.utils.asciiToHex("I am not using a bot"),
        { from: participant2, value: 200 }
      ).should.be.rejected;
    });

    it("lists answers for conductor", async () => {
      result = await surveyReward.getAnswers(0, 1);
      assert.equal(result.length, 1, "Answer count is correct");
      assert.equal(
        web3.utils.hexToAscii(result[0]).replace(/\0/g, ""),
        "An answer on blockchain",
        "Answer is correct"
      );

      // NEGATIVE CASES
      await surveyReward.getAnswers(1, 0).should.be.rejected;
      await surveyReward.getAnswers(0, 5).should.be.rejected;
      await surveyReward.getAnswers(1, 5).should.be.rejected;
      await surveyReward.getAnswers(0, 1, { from: participant }).should.be
        .rejected;
    });
  });
  describe("closed surveys", async () => {
    let result;
    before(async () => {
      await surveyReward.createSurvey(
        "Reward System",
        400,
        "A detailed description 2",
        [web3.utils.asciiToHex("Question 2")],
        {
          from: conductor,
          value: 400,
        }
      );
      await surveyReward.createSurvey(
        "Reward System",
        400,
        "A detailed description 3",
        [web3.utils.asciiToHex("Question 3")],
        {
          from: conductor,
          value: 400,
        }
      );
    });
    it("closes surveys", async () => {
      result = await surveyReward.closeSurvey(1);
      const event = result.logs[0].args;
      assert.equal(event.surveyid.toNumber(), 1, "Survey id is correct");
      assert.equal(event.open, false, "Survey status is correct");
      // NEGATIVE CASES
      await surveyReward.closeSurvey(1).should.be.rejected;
      await surveyReward.closeSurvey(3).should.be.rejected;
      await surveyReward.closeSurvey(2, { from: participant }).should.be
        .rejected;
    });

    it("answers questions", async () => {
      await surveyReward.answerQuestion(1, 0, { from: participant }).should.be
        .rejected;
    });
  });
});
