const { CosmosClient } = require('@azure/cosmos');

let client;

function getCosmosClient() {
  if (!client) {
    const connectionString = process.env.AZURE_COSMOS_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error('AZURE_COSMOS_CONNECTION_STRING is not configured');
    }
    client = new CosmosClient(connectionString);
  }
  return client;
}

function getDatabase() {
  const databaseId = process.env.AZURE_COSMOS_DATABASE || 'studynotebook';
  return getCosmosClient().database(databaseId);
}

function getHabitsContainer() {
  return getDatabase().container('habits');
}

function getStreaksContainer() {
  return getDatabase().container('streaks');
}

function getPracticeSessionsContainer() {
  return getDatabase().container('practice_sessions');
}

function getLearningProfilesContainer() {
  // Container id must match Azure: readme uses `learning_profile` (singular)
  return getDatabase().container('learning_profile');
}

module.exports = {
  getHabitsContainer,
  getStreaksContainer,
  getPracticeSessionsContainer,
  getLearningProfilesContainer,
};
