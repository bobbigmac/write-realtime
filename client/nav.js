
Template.nav.helpers({
  editable: function() {
    return Session.get('editable');
  }
});

Template.nav.events({
  'click .edit-article': function(e, t) {
    var isEditing = Session.get('editing');
    Session.set('editing', !isEditing);
    $('.fragments').sortable("option", "disabled", isEditing)
  },
  'click .add-new-article': function(e, t) {
    addNewArticle(true);
  }
});

function addNewArticle(goTo) {
  var userId = Meteor.userId();
  var article = {};
  if(userId) {
    article.owner = userId;
  }
  Articles.insert(article, function(err, id) {
    if(!err)
    {
      var defaultText = 'Article '+id;
      Fragments.insert({ text: defaultText, articleId: id, tag: 'h1' }, function(err, fragId) {
        if(!err)
        {
          Articles.update({ _id: id }, { $set: { fragmentIds: [fragId], title: defaultText }}, function(err, editOk) {
            if(goTo)
            {
              Session.set('editing', true);
              $('.fragments').sortable("option", "disabled", !Session.get('editing'))
              Router.go('article', { _id: id });
            }
          });
        }
      });
    }
    else {
      console.log('Could not create new article', err);
    }
  });
}