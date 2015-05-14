
Router.configure({
	layoutTemplate: 'layout',
	loadingTemplate: 'loading',
	after: function() {
		Session.set('frag', this.params.hash||null);
	},
	/*waitOn: function () {
		return Meteor.subscribe('Users');
	},*/
});

Router.map(function() {
  this.route('articles', {
    path: '/',
    onBeforeAction: function() {
    	Session.set('editable', false);
    	Session.set('articleId', null);
    	this.next();
    }
  });

  this.route('articlebyname', {
    path: '/:user/:name', 
    onBeforeAction: function() {
    	Session.set('editable', false);
    	Session.set('fragmentPathSearch', {name: this.params.name});
    	this.next();
    },
	waitOn: function() {
		return [
			Meteor.subscribe('fragments', Session.get('fragmentPathSearch')), 
			Meteor.subscribe('articles', Session.get('articleId'))
		];
	},
    data: function() {
    	//TODO: This is weird
    	var fragments = Fragments.find({ tag: 'path', text: this.params.name }).fetch();
    	//TODO: If more than 1 fragments, display some of each and clickable title (redirect to search route)
    	if(fragments && fragments[0])
    	{
    		var article = Articles.findOne(fragments[0].articleId);
    		Session.set('articleId', { articleId: article._id });
    		Session.set('editable', true);

			Meteor.subscribe('fragments', Session.get('articleId'));

	    	return article;
    	}
    	return null;
    }
  });

  this.route('article', {
    path: '/:_id',
    onBeforeAction: function() {
        //console.log('oba');
        $('.container.preload').remove();
    	Session.set('editable', false);
    	Session.set('articleId', { articleId: this.params._id });
    	this.next();
    },
	waitOn: function() {
        //console.log('waitOn');
		var articleId = Session.get('articleId')||false;
		return [
			Meteor.subscribe('fragments', Session.get('articleId')),
			Meteor.subscribe('articles', articleId),
		];
	},
    data: function() {
        //console.log('data');
    	var article = Articles.findOne(this.params._id);
    	Session.set('editable', true);
    	return article;
    },
    // action: function() {
    //     console.log('action');
    // }
  });
});