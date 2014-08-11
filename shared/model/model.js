Fragments = new Meteor.Collection('fragments');
Articles = new Meteor.Collection('articles');


Router.configure({
  layoutTemplate: 'layout'
});

Router.map(function() {
  this.route('articles', {
    path: '/'
  });
  this.route('article', {
    path: '/:_id',
    data: function() {
      return { _id: this.params._id };
    }
  });
});