var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.get('/', function(req, res){
  res.sendfile('client.html');
});

var players = []
var deck = [
  {color:0, num:1}, {color:0, num:1}, {color:0, num:1}, 
  {color:0, num:2}, {color:0, num:2},
  {color:0, num:3}, {color:0, num:3},
  {color:0, num:4}, {color:0, num:4},
  {color:0, num:5},
  {color:1, num:1}, {color:1, num:1}, {color:1, num:1}, 
  {color:1, num:2}, {color:1, num:2},
  {color:1, num:3}, {color:1, num:3},
  {color:1, num:4}, {color:1, num:4},
  {color:1, num:5}/*,
  {color:2, num:1}, {color:2, num:1}, {color:2, num:1}, 
  {color:2, num:2}, {color:2, num:2},
  {color:2, num:3}, {color:2, num:3},
  {color:2, num:4}, {color:2, num:4},
  {color:2, num:5},
  {color:3, num:1}, {color:3, num:1}, {color:3, num:1}, 
  {color:3, num:2}, {color:3, num:2},
  {color:3, num:3}, {color:3, num:3},
  {color:3, num:4}, {color:3, num:4},
  {color:3, num:5},
  {color:4, num:1}, {color:4, num:1}, {color:4, num:1}, 
  {color:4, num:2}, {color:4, num:2},
  {color:4, num:3}, {color:4, num:3},
  {color:4, num:4}, {color:4, num:4},
  {color:4, num:5}*/
]

var currentGame = null

function shuffleDeck() {
  var shuffledDeck = deck.slice(0)
  for (var i=0; i<1000; i++) {
    var randomIdx = Math.floor(Math.random()*shuffledDeck.length)
    shuffledDeck.splice(0, 0, (shuffledDeck.splice(randomIdx, 1))[0])
  }
  console.log(JSON.stringify(shuffledDeck))
  return shuffledDeck
}

function drawCard(theDeck) {
  return theDeck.splice(0,1)[0]
}

function findCardsForPlayer(socketid) {
  for (var i=0; i<currentGame.cards.length; i++) {
    if(socketid == currentGame.cards[i].id) {
      return currentGame.cards[i].cards
    }
  }
  return null
}

function sendCurrentGame(theio) {
  theio.sockets.emit('cards', currentGame.cards)
  theio.sockets.emit('discarded', currentGame.discarded)
  theio.sockets.emit('played', currentGame.played)
  theio.sockets.emit('currentMove', currentGame.currentMove)
  theio.sockets.emit('statuses', currentGame.statuses)
  console.log('sent currentGame:' + JSON.stringify(currentGame))
}

function setToNextMover() {
  var idx = -1
  for (var i=0; i<currentGame.cards.length; i++) {
    if(currentGame.currentMove == currentGame.cards[i].id) {
      idx = i
      currentGame.cards[idx].move = false
      break
    }
  }
  if (idx == (currentGame.cards.length-1)) {
    idx = 0
  } else {
    idx++
  }
  currentGame.cards[idx].move = true
  currentGame.currentMove = currentGame.cards[idx].id
  console.log('setting next mover to: ' + idx + ',' + currentGame.currentMove)
}

function sendGameOverIfNeeded(theio) {
  if (currentGame.statuses.cardsLeft == 0) {
    currentGame.statuses.lives = currentGame.statuses.lives - 1
  }
  if (currentGame.statuses.lives == 0) {
    var score = 0
    for (var i=0; i<currentGame.played.length; i++) {
      score += currentGame.played[i].num
    }
    console.log('game over: ' + score)
    theio.sockets.emit('gameover', score) 
    players = []
    currentGame = []
  }
}

function playCard(playedCard) {
  var inPlayCards = currentGame.played
  for (var i=0; i<currentGame.played.length; i++) {
    if(inPlayCards[i].color == playedCard.color) {
      if ( (inPlayCards[i].num+1) == playedCard.num) {
        inPlayCards[i] = playedCard
        console.log('card played on existing card, success: ' + JSON.stringify(playedCard))
        return true
      } else {
        console.log('card played on existing card, fail: '  + JSON.stringify(playedCard))
        return false
      }
    }
  }
  if (playedCard.num == 1) {
    console.log('new card played, success: ' + JSON.stringify(playedCard))
    currentGame.played.push(playedCard)
    return true
  }
  console.log('invalid new card played, fail: ' + JSON.stringify(playedCard))
  return false
}

io.on('connection', function(socket){
  console.log('user ' + socket.id + ' connected');
  socket.emit('idnotice', socket.id)
  socket.on('name', function(msg) {
    console.log('player (' + socket.id + ') set name to ' + msg)
    players[players.length] = {id:socket.id, name:msg}
    console.log('total players: ' + players.length + ', ' + JSON.stringify(players))
    io.sockets.emit('chat', 'player (' + msg + ') joined game')
    io.sockets.emit('chat', 'waiting for 5 players, current players: ' + players.length)

    if (players.length == 5) {
      console.log('5 players. game will now start')
      var shuffledDeck = shuffleDeck()
      console.log(shuffledDeck.length)
      var data = []
      for(var i=0; i<5; i++) {
        var cards = []
        for(var j=0; j<4; j++) {
          cards[j] = drawCard(shuffledDeck)
        }
        data[i] = {id: players[i].id, name:players[i].name, 'cards':cards}
      }
      console.log(JSON.stringify(data))

      var statuses = {hints: 8, lives: 4, cardsLeft: shuffledDeck.length}
      console.log('status:' + JSON.stringify(statuses))
      
      var played = []
      console.log('played:' + JSON.stringify(played))
      
      var discarded = []
      console.log('discarded:' + JSON.stringify(discarded))
      var randomIdx = Math.floor(Math.random()*5)
      var currentMove = players[randomIdx].id
      data[randomIdx].move = true    
      currentGame = {cards: data, statuses: statuses, played: played, discarded: discarded, remainingDeck: shuffledDeck, currentMove: currentMove}
      
      sendCurrentGame(io)
    }

  })
  socket.on('discard', function(msg) {
    console.log('user ' + socket.id + ' discards - ' + msg)
    var cards = findCardsForPlayer(socket.id)
    if (cards != null) {
      var discardedCard = cards[msg]
      console.log('discarding card: ' + JSON.stringify(discardedCard))
      currentGame.discarded.push(discardedCard)
      console.log('current discards: ' + JSON.stringify(currentGame.discarded))
      var shuffledDeck = currentGame.remainingDeck
      var newCard = drawCard(shuffledDeck)
      console.log('new card: ' + JSON.stringify(newCard))
      cards[msg] = newCard
      var numHints = currentGame.statuses.hints+1
      console.log('numHints:' + numHints)
      currentGame.statuses.hints = Math.min(numHints, 8)
      currentGame.statuses.cardsLeft = shuffledDeck.length
      setToNextMover()
      sendCurrentGame(io)
      sendGameOverIfNeeded(io)
    }
  })
  socket.on('play', function(msg) {
    console.log('user ' + socket.id + ' plays - ' + msg)
    var cards = findCardsForPlayer(socket.id)
    if (cards != null) {
      var playedCard = cards[msg]
      console.log('playing card: ' + JSON.stringify(playedCard))
      var successPlayed = playCard(playedCard)
      if (successPlayed == false) {
        currentGame.statuses.lives = currentGame.statuses.lives-1
        console.log('failed card, lose life: ' + currentGame.statuses.lives)
        currentGame.discarded.push(playedCard)
      } else {
        if (playedCard.num == 5) {
          console.log('success card, gain life: ' + currentGame.statuses.lives)
          var numHints = currentGame.statuses.hints+1
          currentGame.statuses.hints = Math.num(numHints, 8)
        }
      }
      var newCard = drawCard(currentGame.remainingDeck)
      console.log('new card to player: ' + JSON.stringify(newCard))
      cards[msg] = newCard
      currentGame.statuses.cardsLeft = currentGame.remainingDeck.length
      setToNextMover()
      sendCurrentGame(io)
      sendGameOverIfNeeded(io)
    }
  })
  socket.on('rearrange', function(msg) {
    console.log('user ' + socket.id + ' rearranges - ' + JSON.stringify(msg))
    var cards = findCardsForPlayer(socket.id)
    if (cards != null) {
      var cardCopy = cards.slice(0)
      for (var i=0; i<msg.length; i++) {
        cards[i] = cardCopy[msg[i]]
      }
      console.log('old arrangement:' + JSON.stringify(cardCopy))
      console.log('new arrangement:' + JSON.stringify(cards))
      sendCurrentGame(io)
    }
  })
  socket.on('hint', function(msg) {
    console.log('user ' + socket.id + ' sends hint - ' + msg)
    var newHints = currentGame.statuses.hints - 1
    currentGame.statuses.hints = Math.max(newHints, 0)
    setToNextMover()
    sendCurrentGame(io)
    for (var i=0; i<currentGame.cards.length; i++) {
      if(socket.id == currentGame.cards[i].id) {
        io.sockets.emit('chat', 'player (' + currentGame.cards[i].name + ') says ' + msg)
        break
      }
    }
    sendGameOverIfNeeded(io)
  })
  socket.on('disconnect', function() {
    console.log('user ' + socket.id + ' disconnected')
    var playerName = ""
    for (var i=0; i<players.length; i++) {
      if(players[i].id == socket.id) {
        playerName = players.splice(i, 1)[0]
        break
      }
    }
    console.log('total players: ' + players.length + ', ' + JSON.stringify(players))
    io.sockets.emit('chat', 'player (' + playerName.name + ') disconnected')
    io.sockets.emit('chat', 'waiting for 5 players, current players: ' + players.length)

  })
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});
