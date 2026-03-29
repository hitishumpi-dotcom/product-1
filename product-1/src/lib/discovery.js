function discoveryHints(config) {
  return {
    serverIdSuggestion: config.l2reborn.serverId || '3',
    characterIdHelp: 'If the user does not know the character ID yet, ask them to obtain it from their existing setup or game/account tools. Auto-discovery can be built later.',
    accountHelp: 'Use the game login/account for the selected server.',
  };
}

module.exports = { discoveryHints };
