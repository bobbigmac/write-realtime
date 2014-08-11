
if (Meteor.isClient) {

  Template.nav.events({
    'click .add-new-article': function(e, t) {
      Articles.insert({ }, function(err, id) {
        addNewArticle(true);
      });
    }
  });

  var globalFragmentIds = false;
  function updateDocumentFragments(id, remove, position) {
    var articleId = $('.fragments').attr('data-id');//TODO: This is not getting correct id after creating new article (needs manual refresh to pop with correct val)
    
    var article = Articles.findOne({_id: articleId});
    if(article)
    {
      var oldFragmentIds = _.toArray(article.fragmentIds)||[];

      var fragmentIds = [];
      $('.fragment-text').each(function(pos, el) {
        fragmentIds.push($(el).attr('data-id'));
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
        if(oldFragmentIds && oldFragmentIds.length > 0)
        {
          //Update mongo record with diff (so not sending entire list every change)
          var setFields = {};
          for(var pos in diff)
          {
            setFields['fragmentIds.'+pos] = diff[pos];
          }
          Articles.update({ _id: articleId }, { $set: setFields }, function() {
            //console.log('updated by diff');
          });
        }
        else
        {
          Articles.update({ _id: articleId }, { $set: { 'fragmentIds': fragmentIds }}, function() {
            //console.log('updated all');
          });
        }
      }
    }
    else
    {
      console.log('No article', article);
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
        //var fragEndPoint = article.fragmentIds||Session.get('fragmentIds');
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
        var id = $(range.startContainer).parents('.fragment-text').first().attr('data-id');
        if(id && (range.startOffset > 0 || range.endOffset > 0))
        {
          savedRanges[id] = { start: range.startOffset, end: range.endOffset };
        }
        else if(id) {
          //savedRanges[id] = { start: 0, end: 0 };
        }
      }
    });

    this.$('.fragments').sortable({
      helper: '.handle',
      cancel: '[contenteditable],select',
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

  function restoreRange(el, id) {
    if(savedRanges[id] && (savedRanges[id].start || savedRanges[id].end)) {
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
        })(el, sel, range, id);
      }
    }
  }
  function getSelectionCoords() {
      var sel = document.selection, range, rect;
      var x = 0, y = 0;
      if (sel) {
          if (sel.type != "Control") {
              range = sel.createRange();
              range.collapse(true);
              x = range.boundingLeft;
              y = range.boundingTop;
          }
      } else if (window.getSelection) {
          sel = window.getSelection();
          if (sel.rangeCount) {
              range = sel.getRangeAt(0).cloneRange();
              if (range.getClientRects) {
                range.collapse(true);
                rect = range.getClientRects()[0];
                if(rect)
                {
                  x = rect.left;
                  y = rect.top;
                }
                else
                {
                  x = 0;
                  y = 0;
                }
              }
              // Fall back to inserting a temporary element
              if (x == 0 && y == 0) {
                  var span = document.createElement("span");
                  if (span.getClientRects) {
                      // Ensure span has dimensions and position by
                      // adding a zero-width space character
                      span.appendChild( document.createTextNode("\u200b") );
                      range.insertNode(span);
                      rect = span.getClientRects()[0];
                      x = rect.left;
                      y = rect.top;
                      var spanParent = span.parentNode;
                      spanParent.removeChild(span);

                      // Glue any broken text nodes back together
                      spanParent.normalize();
                  }
              }
          }
      }
      return { x: x, y: y };
  }
  var arrows = {
    37: "left",
    38: "up",
    39: "right",
    40: "down",
  };
  var startText = false;
  Template.fragment.events({
    'focus .fragment-text': function(e, t) {
      var fragment = $(t.find('.fragment-text'));
      startText = fragment.text();
      //$(e.currentTarget).attr('contenteditable', true);
    },
    'blur .fragment-text': function(e, t) {
      var fragment = $(t.find('.fragment-text'));
      var newText = fragment.text();
      
      if(newText != startText || !startText)
      {
        if(!newText)
        {
          if(this._id)
          {
            updateDocumentFragments(this._id, true);
            Fragments.remove({ _id: this._id });
          }
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
      else if(arrows[e.keyCode])
      {
        var dir = arrows[e.keyCode];
        var coords = getSelectionCoords();
        var el = $(e.target);
        var offset = el.offset();
        var height = el.height(), width = el.width(), top = coords.y - offset.top, left = coords.x - offset.left;
        var lineHeight = 20; //TODO: By actual line-height

        if((dir == "up" && top <= 2) ||
          (dir == "down" && top >= (height - lineHeight)))
        {
          var nextText = false;
          if(dir == "up")
          {
            nextText = el.parent().prev().find('.fragment-text').first();
          }
          else
          {
            nextText = el.parent().next().find('.fragment-text').first();
          }
          if(nextText && nextText.length > 0)
          {
            nextText.focus();
            //restoreRange(e.target, this._id);//This will only work if you detect and ignore onselectionchanged for this keydown
            return false;
          }
        }
        else //TODO: Left/right for paragraph style/reference options UI
        {

        }
      }
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
            position = (globalFragmentIds||[]).indexOf($(e.target).attr('data-id'))+1;
          }
          var articleId = $('.fragments').attr('data-id');
          
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
        restoreRange(e.currentTarget, this._id);
      }
    },
    'change .fragment-set-tag': function(e, t) {
      var tag = $(e.target).val();
      Fragments.update({_id: this._id}, {$set: {tag: tag}});
    }
  });

  function onTagTypeRefresh() {
    var sPicker = $('.fragment-container[data-id="' + this.data._id + '"] .fragment-set-tag');
    sPicker.selectpicker('refresh');
  }

  //Bind refresh of the non-reactive select when tagtype is changed remotely
  Template.fragmenttagh4.rendered = 
  Template.fragmenttagh3.rendered = 
  Template.fragmenttagh2.rendered = 
  Template.fragmenttagh1.rendered = 
  Template.fragmenttagp.rendered = onTagTypeRefresh; //TODO: Define these from supportedTags array

  Template.fragment.tag = function(e, t) {
    return this.tag||'p';
  };
  var renderTimeout = false;
  Template.fragment.rendered = function() {
    this.$('.fragment-set-tag').selectpicker();

    //TODO: Probably want to focus only after an enter-press
    this.$('.fragment-text').focus();
  };

  Template.articles.articles = function() {
    return Articles.find({});
  }
  Template.articles.events({
    'click .remove-article': function(e, t) {

    }
  });
  function addNewArticle(goTo) {
    Articles.insert({ }, function(err, id) {
      if(!err)
      {
        Fragments.insert({text: 'Welcome to your new document '+id, articleId: id}, function(err, fragId) {
          if(!err)
          {
            Articles.update({ _id: id }, { $set: { fragmentIds: [fragId] }}, function(err, editOk) {
              if(goTo)
              {
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
  Template.articleLink.linkUrl = function() {
    return Router.routes['article'].url({_id: this._id});
  }
  Template.articleLink.linkText = function() {
    return this._id;
  }

}