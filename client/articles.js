
Template.articles.rendered = function() {
  Deps.autorun(function() {
    Meteor.subscribe('articles', Session.get('articleId')||false);
  })
};

Template.articles.helpers({
  articles: function() {
    return Articles.find({});
  }
});

Template.articles.events({
});
