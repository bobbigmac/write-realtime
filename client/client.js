
if (Meteor.isClient) {
  var globalFragmentIds = false;
  function updateDocumentFragments(id, remove, position) {
    var articleId = $('.fragments').data().id;
    var article = Articles.findOne({_id: articleId});
    if(article)
    {
      var oldFragmentIds = _.toArray(article.fragmentIds)||[];

      var fragmentIds = [];
      $('.fragment-text').each(function(pos, el) {
        fragmentIds.push($(el).data().id);
      });

      if(articleId)
      {
        var fragIndex = fragmentIds.indexOf(id);
        
        if(!remove && fragIndex === -1)
        {
          if(position !== false && position > -1)
          {
            fragmentIds.splice(position, 0, id);
          }
          else
          {
            fragmentIds.push(id);
          }
        }
        else if(remove && fragIndex > -1)
        {
          fragmentIds.splice(fragIndex, 1);
        }
      }
      function highestOf(a, b) {
        return (a > b ? a : b);
      }
      var diff = {}, changeCount = 0;
      for(var i=0; i<highestOf(fragmentIds.length, oldFragmentIds.length); i++)
      {
        if(fragmentIds[i] !== oldFragmentIds[i])
        {
          diff[i] = (fragmentIds[i] ? fragmentIds[i] : null);//Mongo doesn't like undefined, forcing null
          changeCount++;
        }
      }

      if(changeCount)
      {
        globalFragmentIds = fragmentIds;
        if(!(oldFragmentIds && oldFragmentIds.lenth > 0))
        {
          //Update mongo record with diff (so not sending entire list every change)
          var setFields = {};
          for(var pos in diff)
          {
            setFields['fragmentIds.'+pos] = diff[pos];
          }
          Articles.update({ _id: articleId }, { $set: setFields });
        }
        else
        {
          Articles.update({ _id: articleId }, { $set: { 'fragmentIds': fragmentIds }});
        }
      }
      else
      {
        //console.log('nothing changed');
      }
    }
    else
    {
      //console.log('No article', article);
    }
  }

  Template.article.fragments = function () {
    var articleId = this._id;
    var fragments = Fragments.find({ articleId: articleId });
    if(fragments.count() > 0)
    {
      var article = Articles.findOne({ _id: articleId });
      if(article)
      {
        var fragmentIds = _.toArray(article.fragmentIds)||[];
        
        var sortedFragments = [];
        if(!fragmentIds.length)
        {
          fragments.map(function(data, pos) {
            if(fragmentIds && fragmentIds.indexOf(data._id) === -1)
            {
              fragmentIds.push(data._id);
            }
          });
        }
        globalFragmentIds = fragmentIds;

        if(fragmentIds.length)
        {
          for(var i = 0; i < fragmentIds.length; i++)
          {
            var fragId = Fragments.findOne({ _id: fragmentIds[i]});
            if(fragId)
            {
              sortedFragments.push(fragId);
            }
          }
          return sortedFragments;
        }
        else
        {
          //console.log('no sorted fragments to push')
        }
      }
    }
    return [{text: "", articleId: articleId}];
  }

  var savedRanges = {};//Store this in a collection if you want it to sync to remote viewers/editors

  var ctrlIsDown = false;
  Template.article.events({
    'keyup': function(e, t) {
      if(ctrlIsDown && !e.ctrlKey)
      {
        ctrlIsDown = false;
      }
    },
    'keydown': function(e, t) {
      if(!ctrlIsDown && e.ctrlKey)
      {
        ctrlIsDown = true;
      }
    }
  });

  Template.article.rendered = function() {
    $(document).off('selectionchange');
    $(document).on('selectionchange', function(e, t) {
      var sel = window.getSelection && window.getSelection();
      if (sel && sel.rangeCount > 0) {
        var range = sel.getRangeAt(0);
        var id = $(range.startContainer).parents('.fragment-text').first().data('id');
        if(id && (range.startOffset > 0 || range.endOffset > 0))
        {
          savedRanges[id] = { start: range.startOffset, end: range.endOffset };
        }
      }
    });

    this.$('.fragments').sortable({
      helper: '.handle',
      cancel: '[contenteditable]',
      stop: function(event, ui) {
        updateDocumentFragments();
      },
      /*start: function(event, ui) {
        return false;
      }*/
    }).enableSelection().on('click', function(event, ui) {
      if(event.target)
      {
        //TODO: Currently losing clicked-caret-position with this focus call (and not restoring saved)
        $(event.target).focus();
      }
    })
  };
  Template.fragment.rendered = function() {
    this.$('.fragment-text').focus();
  };

  var startText = false;
  Template.fragment.events({
    'focus .fragment-text': function(e, t) {
      startText = $(e.currentTarget).text();
      //$(e.currentTarget).attr('contenteditable', true);
    },
    'blur .fragment-text': function(e, t) {
      var fragment = $(t.find('.fragment-text'));
      var newText = fragment.text();

      if(newText != startText || !startText)
      {
        if(!newText)
        {
          updateDocumentFragments(this._id, true);
          Fragments.remove({ _id: this._id });
        }
        else
        {
          Fragments.update({_id: this._id}, { $set: { text: newText }});

          //bodges around meteor concatenating session values to div content on rerender (okay here because we're not listening on changed event)
          fragment.text('');
        }
      }
      startText = false;
      ctrlIsDown = false;
      //$(e.currentTarget).removeAttr('contenteditable');
    },
    'keydown .fragment-text': function(e, t) {
      if(e.keyCode == 13)
      {
        return false;
      }
      else if(e.keyCode == 27)
      {
        $(e.target).text(startText);
      }
      //TODO: Check for arrows (up on top row, down on bottom row, right at end pos, left at start pos)
    },
    'keyup .fragment-text': function(e, t) {
      if(e.keyCode == 13)
      {
        var nextText = $(e.target).parent().next().find('.fragment-text').first();
        if(!(nextText && nextText.length > 0) || ctrlIsDown)
        {
          var position = false;
          //Use ctrl+enter to insert after the current fragment
          if(ctrlIsDown) {
            position = (globalFragmentIds||[]).indexOf($(e.target).data().id)+1;
          }
          var articleId = $('.fragments').data().id;
          
          Fragments.insert({ text: '', articleId: articleId }, function(err, id) {
            updateDocumentFragments(id, false, position);
          });
        }
        else
        {
          nextText.focus();
        }
        return false;
      }
      else if(e.keyCode == 9) {
        if(savedRanges[this._id]) {
          if(window.getSelection) {
            var range = document.createRange();
            var sel = window.getSelection();
            (function(el, sel, range, id) {
              var maxLength = $(el).text().length;
              var savedRange = savedRanges[id];
              var startPos = (savedRange.start < maxLength ? savedRange.start : maxLength);
              var endPos = (savedRange.end < maxLength ? savedRange.end : maxLength);
              el.normalize();
              try {
                range.setStart(el.firstChild, startPos);
                range.setEnd(el.lastChild, endPos);
                sel.removeAllRanges();
                sel.addRange(range);
              }
              catch(exc) {
                console.log("Couldn't set a range for node", id) // can get exception when removing multiple fragments
              }
            })(e.currentTarget, sel, range, this._id);
          }
        }
      }
    }
  });

  Template.articles.articles = function() {;
    return Articles.find({});
  }
  Template.articles.events({
    'click .remove-article': function(e, t) {

    },
    'click .add-new-article': function(e, t) {
      Articles.insert({ }, function(err, id) {
        if(!err)
        {
          Router.go('article', { _id: id });
        }
        else {
          console.log('Could not create new article', err);
        }
      });
    }
  });
  Template.articleLink.linkUrl = function() {
    return Router.routes['article'].url({_id: this._id});
  }
  Template.articleLink.linkText = function() {
    return this._id;
  }

}