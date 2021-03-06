app = require('./app.coffee')
Message = require('./message_model.coffee')
MessageView = require('./message_view.coffee')
Conversation = require('./conversation_model.coffee')
UserView = require('./user_view.coffee')
PersistentConversationView = require('./persistent_conversation_view.coffee')
chat_room_template = require('./templates/chat_room.hbs')
Handlebars = require('hbsfy/runtime')
Handlebars.registerHelper 'title_bar_function', ->
  if @convo_partners.length < 2
    @convo_partners[0].display_name
  else
    @first_name_list



## constructor for object containing template and user
## interaction logic for each open chat window.
## watches a conversation model.
class ChatRoom

  constructor: (@convo) ->
    @$element = $('<div class="parley"></div>')
    @render()
    $('body').append(@$element)
    @loadPersistentMessages()

    @pubsub_listeners =
                    'user_logged_on': @sync_user_logged_on.bind(this)
                    'user_logged_off': @sync_user_logged_off.bind(this)
                    'new_convo': @sync_new_convo.bind(this)
                    'picture_message': @renderDiscussion.bind(this)

    @socket_listeners =
                    'message': @message_callback.bind(this)
                    'user_offline': @user_offline_callback.bind(this)
                    'typing_notification': @typing_notification_callback.bind(this)

    for prop, value of @pubsub_listeners
      app.pub_sub.on(prop,value)

    for prop, value of @socket_listeners
      app.server.on(prop, value)

    ## for add users view
    @add_user_bar = '<div class="add-user-bar"><a class="cancel">Cancel</a><a class="confirm disabled">Add People</a></div>'



  message_callback: (message) ->
    if @convo.message_filter is message.convo_id
      new_message = new Message(message.recipients, message.sender, message.content, message.image, message.time_stamp)

      @convo.add_message(new_message, true)
      if @menu is "chat"
        @renderDiscussion()
        @$element.find('.top-bar').addClass('new-message')
        @titleAlert()

  user_offline_callback: ->
    if @menu is "chat"
      message = new Message( app.me, {image_url:'http://storage.googleapis.com/parley-assets/server_network.png'}, "This user is no longer online", false, new Date() )
      @convo.add_message(message)
      @renderDiscussion()

  typing_notification_callback: (convo_id, typist, bool) ->
    if @menu is "chat"
      if convo_id is @convo.message_filter
        if bool
          if @$discussion.find('.incoming').length is 0
            typing_notification = "<li class='incoming'><div class='avatar'><img src='#{typist.image_url}'/></div><div class='messages'><p>#{typist.display_name} is typing...</p></div></li>"
            @$discussion.append(typing_notification)
            @scrollToLastMessage()
        else
          @$discussion.find('.incoming').remove()
          @scrollToLastMessage()

  switch_to_persistent_convo: (e) ->
    e.preventDefault()
    e.stopPropagation()
    if @menu isnt "convo_switch"
      @$discussion.children().remove()
      @$element.find('textarea.send').remove()
      @$element.find('.mirrordiv').remove()
      @$element.find('.parley_file_upload').remove()
      @$element.find('label.img_upload').remove()
      for convo in app.conversations
        if convo.messages.length > 0
          view = new PersistentConversationView(convo, this)
          view.render()
          @$discussion.append(view.$element)
      @menu = "convo_switch"
    else
      @render()
      @loadPersistentMessages()


  add_users_to_convo: (e) ->
    e.preventDefault()
    @menu = "add_users"
    @new_convo_params = []
    @$discussion.children().remove()
    @$discussion.append('<input class="search" placeholder="Add People">')
    for user in app.current_users
      view = new UserView(user, this)
      view.render()
      @$discussion.append(view.$element)
    @$discussion.append(@add_user_bar)
    @$element.find('.cancel').on 'click', @cancel_add_users.bind(this)

  cancel_add_users: (e) ->
    e.preventDefault()
    @render()
    @loadPersistentMessages()
    @new_convo_params = []

  confirm_new_convo_params: (e) ->
    e.preventDefault()
    ## adds existing convo members to new convo params to get new key
    new_convo_partners = @convo.convo_partners
    convo_partners_image_urls = @convo.message_filter.split(',')
    for user in @new_convo_params
      convo_partners_image_urls.push(user.image_url)
      new_convo_partners.push(user)
    convo_id = convo_partners_image_urls.sort().join()
    ## check to make sure convo is not already open
    for convo in app.open_conversations
      if convo_id is convo
        return
    ##check to see if persistent convo exists with group if so load from that
    convo_exists = false
    for convo in app.conversations
      if convo.message_filter is convo_id
        convo_exists = true
        persistent_convo = convo
    if convo_exists
      @convo = persistent_convo
      app.open_conversations.push(convo_id)
    else
      ## create new conversation consisting of selected users added to existing convo members
      conversation = new Conversation(new_convo_partners)
      @convo = conversation
      app.conversations.push(conversation)
      app.open_conversations.push(convo_id)
    @$element.find('.add-user-bar').remove()
    @render()
    @loadPersistentMessages()
    @new_convo_params = []

  render: ->
    @menu = "chat"
    @$element.children().remove()
    @$element.html(chat_room_template(@convo))
    @$discussion = @$element.find('.discussion')

    ## create and append hidden div for message input resizing
    @$mirror_div = $("<div class='mirrordiv'></div>")
    @$element.find('section.conversation .message-area').append @$mirror_div
    @hidden_div_height = @$element.find('.mirrordiv').css('height')

    ## create variable for fileupload to add and remove
    @$file_upload = @$element.find('label.img_upload')

    ## LISTENERS FOR USER INTERACTION WITH CHAT WINDOW
    @$element.find('.chat-close').on 'click', @closeWindow.bind(this)
    @$element.find('.entypo-user-add').on 'click', @add_users_to_convo.bind(this)
    @$element.find('.entypo-chat').on 'click', @switch_to_persistent_convo.bind(this)
    @$element.find('.send').on 'keypress', @sendOnEnter.bind(this)
    @$element.find('.send').on 'keyup', @emitTypingNotification.bind(this)
    @$element.find('.send').on 'keyup', @grow_message_field.bind(this)
    @$element.find('.send').on 'keyup', @toggle_file_upload_button.bind(this)
    @$element.find('.top-bar, minify ').on 'click', @toggleChat.bind(this)
    @$element.on 'click', @removeNotifications.bind(this)
    @$element.find('input.parley_file_upload').on 'change', @file_upload.bind(this)

  renderDiscussion: ->
    new_message = @convo.messages.slice(-1)[0]
    @appendMessage(new_message)
    @scrollToLastMessage()

  appendMessage: (message)->
    message_view = new MessageView(message)
    message_view.render()
    @$discussion.append(message_view.$element)

  scrollToLastMessage: ->
    @$discussion.scrollTop( @$discussion.find('li:last-child').offset().top + @$discussion.scrollTop() )

  loadPersistentMessages: ->
    for message in @convo.messages
      @appendMessage(message)
    if @convo.messages.length > 0
      @scrollToLastMessage()

  sendOnEnter: (e)->
    if e.which is 13
      e.preventDefault()
      @sendMessage()
      @removeNotifications()

  sendMessage: ->
    message = new Message @convo.convo_partners, app.me, @$element.find('.send').val()
    @convo.add_message(message, true)
    @renderDiscussion()
    console.log('hello')
    app.server.emit 'message', message
    @$element.find('.send').val('')
    @emitTypingNotification()

  toggleChat: (e) ->
    e.preventDefault()
    @$element.find('.message-area').toggle()
    if @$discussion.attr('display') is not "none"
      @scrollToLastMessage

  closeWindow: (e) ->
    e.preventDefault()
    e.stopPropagation()
    ## remove from open convos
    new_open_convos = []
    for open_convo in app.open_conversations
      if open_convo isnt @convo.message_filter
        new_open_convos.push(open_convo)
    app.open_conversations = new_open_convos

    ## remove all listeners for garbage collection
    for prop, value of @socket_listeners
      app.server.removeListener(prop,value)
    app.pub_sub.off()
    @$element.remove()

  removeNotifications: (e) ->
    @$element.find('.top-bar').removeClass('new-message')
    if app.title_notification.notified
      @clearTitleNotification()

  emitTypingNotification: (e) ->
    if @$element.find('.send').val() isnt ""
      app.server.emit 'user_typing', @convo.convo_partners_image_urls, app.me, true
    else
      app.server.emit 'user_typing', @convo.convo_partners_image_urls, app.me, false

  clearTitleNotification: ->
    app.clear_alert()
    $('html title').html( app.title_notification.page_title )
    app.title_notification.notified = false

  titleAlert: ->
    if not app.title_notification.notified
      sender_name = @convo.messages[@convo.messages.length - 1].sender.display_name
      alert = "Pending ** #{sender_name}"
      setAlert = ->
        if app.title_notification.page_title is $('html title').html()
          $('html title').html(alert)
        else
          $('html title').html( app.title_notification.page_title)

      title_alert = setInterval(setAlert, 2200)

      app.clear_alert = ->
        clearInterval(title_alert)

      app.title_notification.notified = true

  file_upload: ->
    console.log('hear click')
    file = @$element.find('.parley_file_upload').get(0).files[0]
    app.oauth.file_upload file, @convo.convo_partners, @convo.message_filter

  grow_message_field: ->
    $txt = @$element.find('textarea.send')
    content = $txt.val()
    adjusted_content = content.replace(/\n/g, "<br>")
    @$mirror_div.html(adjusted_content)
    @hidden_div_height = @$mirror_div.css('height')
    if @hidden_div_height isnt $txt.css('height')
      $txt.css('height', @hidden_div_height)


  toggle_file_upload_button: ->
    ## remove icon for file upload
    if @$element.find('textarea.send').val() isnt ""
      if @$element.find('label.img_upload').length is 1
        @$element.find('label.img_upload').remove()
    else
      if @$element.find('label.img_upload').length is 0
        @$element.find('section.conversation').append(@$file_upload)
        @$element.find('input.parley_file_upload').on 'change', @file_upload.bind(this)

  sync_user_logged_on: (e, user, index, location) ->


    if @menu is "add_users"
      view = new UserView(user, this)
      view.render()
      if location is "first" or location is "last"

        @$discussion.children().eq(-1).before(view.$element)
      else

        @$discussion.find('li.user').eq(index).before(view.$element)

  sync_user_logged_off: (e, user, index) ->
    if @menu is "add_users"
      @$discussion.find('li.user').eq(index).remove()
      return

  sync_new_convo: (e, new_convo) ->
    if @menu is "convo_switch"
      view = new PersistentConversationView(new_convo, this)
      view.render()
      $('.parley div.controller-view').prepend(view.$element)


module.exports = ChatRoom
