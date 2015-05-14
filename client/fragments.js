
function onTagTypeRefresh(e, t) {
  var container = $('.fragment-container[data-id="' + this.data._id + '"]');
  container.find('.fragment-set-tag').selectpicker('refresh');
  // if generating tags dynamically.. it's not updating selectpicker to show correct option when changed remotely (need to force rerender the selected attribute)

  var frag = Session.get('frag');
  if(frag && frag == this.data._id) {
    var offset = container.offset();
    if (offset){
      $('html, body').animate({scrollTop: offset.top}, 400);
      Session.set('frag', null);
    }
    else
    {
      console.log('no offset')
    }
  }
  //container.find('.fragment-text').focus();
}

var allTags = {
  'p': 'p', 
  'q': 'quote', 
  'h1': 'h1', 
  'h2': 'h2', 
  'h3': 'h3', 
  'h4': 'h4', 
  'bq': 'blockquote', 
  'nb': 'private',
  're': 'reply', 
  'tag': 'tag', 
  'css': 'css', 
  'meta': 'meta', 
  'path': 'path',
  /*'hr': 'hr',
  'table': 'table',
  'span': 'span',*/
};
Template.addfragment.helpers({
  tags: function(e, t) {
    return _.map(allTags, function(el, key) {
      return key;
    });
  }
});
Template.fragment.helpers({
  tags: function(e, t) {
    return _.map(allTags, function(el, key) {
      return key;
    });
  }
});

for(var tag in allTags)
{
  Template['fragmenttag'+allTags[tag]].rendered = onTagTypeRefresh;
}
Template.fragmenttagpath.helpers({
  canonical: function(e, t) {
    //TODO: Get article id, get article title, build path, and navigate to it
    //console.log('build canonical url for', this._id, this.text);
  }
});
Template.fragment.helpers({
  inline: function(e, t) {
    return this.inline ? 'true' : 'false';
  },
  tag: function(e, t) {
    return this.tag||'p';
  }
});

Template.fragment.rendered = function() {
  this.$('.fragment-set-tag').selectpicker();

  //TODO: Probably want to focus only after an enter-press
  this.$('.fragment-text').focus();
};