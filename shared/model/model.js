Fragments = new Meteor.Collection('fragments');
Articles = new Meteor.Collection('articles');

UI.registerHelper("equals", function (a, b) {
	return (a == b);
});
UI.registerHelper("split", function (text, sep, index) {
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
UI.registerHelper('editable', function(key, value){
	var isEditing = Session.get('editing');
	var id = this._id;
	//Maybe overkill, but only solution I can find since .rendered now only fires on creation. Is there a .updated or similar yet?
	Meteor.defer(function() {
	    var matchEl = $('.fragment-text[data-id="'+id+'"]');
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
    }
  });

  this.route('articlebyname', {
    path: '/:user?/:name', 
    onBeforeAction: function() {
    	Session.set('fragmentPathSearch', {name: this.params.name});
    },
	waitOn: function() {
		return [
			Meteor.subscribe('fragments', Session.get('fragmentPathSearch')), 
			Meteor.subscribe('articles', Session.get('articleId'))
		];
	},
    data: function() {
    	var fragments = Fragments.find({ tag: 'path', text: this.params.name }).fetch();
    	//TODO: If more than 1 fragments, display some of each and clickable title (redirect to search route)
    	if(fragments && fragments[0])
    	{
    		Session.set('articleId', { articleId: fragments[0].articleId });

			Meteor.subscribe('fragments', Session.get('articleId'));

	    	return { _id: fragments[0].articleId };
    	}
    	return null;
    }
  });

  this.route('article', {
    path: '/:_id',
    onBeforeAction: function() {
    	Session.set('articleId', { articleId: this.params._id });
    },
	waitOn: function() {
		var articleId = Session.get('articleId')||false;
		return [
			Meteor.subscribe('fragments', Session.get('articleId')),
			Meteor.subscribe('articles', articleId),
		];
	},
    data: function() {
    	return { _id: this.params._id };
    }
  });
});