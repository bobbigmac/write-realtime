
if (Meteor.isServer) {
  Meteor.startup(function () {

    Meteor.publish('articles', function(options) {
      var search = {};

      var opts = { limit: 50 };
      if(!options || !options.articleId) {
        opts['fields'] = { fragmentIds: 0 };
      }
      else if(options.articleId)
      {
        search._id = options.articleId;
      }
      //console.log(options, Articles.findOne(search, opts));
      return Articles.find(search, opts);
    });

    Meteor.publish('fragments', function(options) {
      var search = {};
      if(options && options.name) {
        search.tag = 'path';
        search.text = options.name;
      }
      if(options && options.articleId) {
        search.articleId = options.articleId;
      }
      return Fragments.find(search);
    })
  });
}