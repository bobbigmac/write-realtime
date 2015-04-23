Fragments = new Meteor.Collection('fragments');
Articles = new Meteor.Collection('articles');

UI.registerHelper("equals", function (a, b) {
	return (a == b);
});

UI.registerHelper("split", function (text, sep, index) {
	//TODO: Not sure how to account for namespaced (like og) meta tags
	return (text||':').split(sep||':')[index];
});

function Linkify(inputText) {
	//See http://stackoverflow.com/a/2166104/1358220
	//URLs starting with http://, https://, or ftp://
	var replacePattern1 = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
	var replacedText = inputText.replace(replacePattern1, '<a href="$1" target="_blank">$1</a>');

	//URLs starting with www. (without // before it, or it'd re-link the ones done above)
	var replacePattern2 = /(^|[^\/])(www\.[\S]+(\b|$))/gim;
	var replacedText = replacedText.replace(replacePattern2, '$1<a href="http://$2" target="_blank">$2</a>');

	//Change email addresses to mailto:: links
	var replacePattern3 = /(\w+@[a-zA-Z_]+?\.[a-zA-Z]{2,6})/gim;
	var replacedText = replacedText.replace(replacePattern3, '<a href="mailto:$1">$1</a>');

	return replacedText
}

UI.registerHelper('articleTitleFromId', function(key, value){
	return 'Temp title for ' + key;
});

UI.registerHelper('editable', function(key, value){
	var isEditing = Session.get('editing');
	var id = this._id;
	//Maybe overkill, but only solution I can find since .rendered now only fires on creation. Is there a .updated or similar yet?
	Meteor.defer(function() {
	    var matchEl = $('.fragment-text[data-id="'+id+'"]').not('style,meta');
	    if(matchEl.length > 0)
	    {
			if(matchEl.attr('contenteditable') !== 'true')
			{
				var text = matchEl.text();
				var newText = Linkify(text);
				if(newText != text)
				{
					matchEl.html(newText);
					matchEl.find('a').on('click', function(e) {
						e.stopPropagation();
					});
				}
			}
			else
			{
				//matchEl.text(matchEl.text());
				var oldLinks = matchEl.find('a');
				oldLinks.each(function(pos, el) {
					var oldLink = $(el);
					oldLink.replaceWith(oldLink.text());
				});
			}
	    }
	});

	return isEditing ? 'true' : 'false';
});

UI.registerHelper('editing', function(key, value){
	return Session.get('editing');
});

UI.registerHelper('selected', function(key, value){
	//console.log(key, 'vs', value)
	return key == value ? {selected:'selected'} : '';
});


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
    	Session.set('articleId', null);
    	this.next();
    }
  });

  this.route('articlebyname', {
    path: '/:user/:name', 
    onBeforeAction: function() {
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

			Meteor.subscribe('fragments', Session.get('articleId'));

	    	return article;
    	}
    	return null;
    }
  });

  this.route('article', {
    path: '/:_id',
    onBeforeAction: function() {
    	Session.set('articleId', { articleId: this.params._id });
    	this.next();
    },
	waitOn: function() {
		var articleId = Session.get('articleId')||false;
		return [
			Meteor.subscribe('fragments', Session.get('articleId')),
			Meteor.subscribe('articles', articleId),
		];
	},
    data: function() {
    	var article = Articles.findOne(this.params._id);
    	return article;
    }
  });
});