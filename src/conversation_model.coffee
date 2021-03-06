app = require('./app.coffee')

## constructor for conversations objects that represent all relevant
## data and logic pertaining to managing a conversation
## including a collection of message objects.
class Conversation

  constructor: (@convo_partners, @messages=[], @notify=false) ->
    @generate_message_filter()
    @first_name_list = ""
    @convo_partners_image_urls = []

    ## dummy object for pub/sub
    @pub_sub = $({})

    for user, i in @convo_partners
      first_name = user.display_name.match(/^[A-z]+/)
      if (i + 1) isnt @convo_partners.length
        @first_name_list += "#{first_name}, "
        @convo_partners_image_urls.push(user.image_url)
      else
        @first_name_list += "#{first_name}"
        @convo_partners_image_urls.push(user.image_url)

  add_message: (message, silent) ->
    @messages.push message
    if not silent
      $('.parley div.controller-bar a.messages').addClass('notify')
      @notify = true
      @pub_sub.trigger('convo_new_message', message)


  generate_message_filter: ->
    @message_filter = [app.me.image_url]
    for partner in @convo_partners
      @message_filter.push partner.image_url
    @message_filter = @message_filter.sort().join()

module.exports = Conversation
