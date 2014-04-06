## this is the contructor for the global object that when initialized
## executes all neccesary operations to get this train moving.
Parley = (window.Parley ||= {})

Parley.initalizers = []

Parley.onInit = (fn) ->
  @initalizers.push(fn)

class Parley.app

  constructor: ->
    @current_users = []
    @open_conversations = []
    @conversations = []


    ## listen for persistent conversations from the server on load.
    ## will be sent in one at a time from redis on load.
    @server.on 'persistent_convo', @load_persistent_convo

    ## insert script for google plus signin
    do ->
      var po = document.createElement('script'); po.type = 'text/javascript'; po.async = true
      po.src = 'https://apis.google.com/js/client:plusone.js'
      var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(po, s)

    ## runs each init function
    init(this) for init in Parley.initializers


  server: io.connect('wss://' + window.location.hostname)


    initializers.push(func)


  load_persistent_convo: (convo_key, messages) ->
    ## takes convo_key and converts to convo_partners for conversation creation
    convo_members = convo_key.split(',')
    for id in convo_members
      if id isnt @app.me.image_url
        convo_partners += id

    ## create new conversation object from persistent conversation info
    convo = new Conversation(convo_partners, messages)
    @conversations.push(convo)


