
if (Meteor.isClient) {

  Session.setDefault('editing', false);

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

  var globalFragmentIds = false;
  function updateDocumentFragments(id, remove, position) {
    id = (id instanceof Array ? id : (id ? [id] : []));

    var articleId = $('.fragments').attr('data-id');
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
        for(var idPos = id.length-1; idPos >= 0; idPos--)
        {
          var fragId = id[idPos];
          var fragIndex = fragmentIds.indexOf(fragId);
          
          if(!remove && fragIndex === -1)
          {
            if(position !== false && position > -1)
            {
              fragmentIds.splice(position, 0, fragId);
            }
            else
            {
              fragmentIds.push(fragId);
            }
          }
          else if(remove && fragIndex > -1)
          {
            fragmentIds.splice(fragIndex, 1);
          }
        }
      }

      var diff = {}, changeCount = 0, newTitle = false;
      for(var i=0; i<highestOf(fragmentIds.length, oldFragmentIds.length); i++)
      {
        if(fragmentIds[i] !== oldFragmentIds[i])
        {
          diff[i] = (fragmentIds[i] ? fragmentIds[i] : null);//Mongo doesn't like undefined, forcing null

          changeCount++;
        }
        if((i === '0' || i === 0) && position === 0) {
          newTitle = $('.fragment-container:first .fragment-text').text().substring(0, 128).trim();
          Articles.update({ _id: articleId }, { $set: { 'title': newTitle }}, function() {
            //console.log('updated article title after it was edited');
          });
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
            if((pos === 0 || pos === '0') && diff[pos]) {
              newTitle = $('.fragment-container:first .fragment-text').text().substring(0, 128).trim();
              Articles.update({ _id: articleId }, { $set: { 'title': newTitle }}, function() {
                //console.log('updated article title after it was moved');
              });
            }
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
        if(article.title)
        {
          document.title = article.title+" on WriteRealtime";
        }
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

    return false;
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

  function getSelectionRange(cb) {
    var sel = window.getSelection && window.getSelection();
    if (sel && sel.rangeCount > 0) {
      var range = sel.getRangeAt(0);
      cb(range);
    }
  }
  /*function setupAutorun () {
    Deps.autorun(function (){
        var hash =  Session.get('frag');
        if (hash) {
          var el = $('.fragment-container[data-id="'+hash+'"]');
          var offset = el.offset();
          if (offset){
            console.log('animating to scroll pos', offset.top);
            $('html, body').animate({scrollTop: offset.top}, 400);
            Session.set('hash', '');
          }
          else
          {
            console.log('no offset', offset, el)
          }
        }
    });
  }*/
  //TODO: Will want to put these document binds somewhere else if displaying more than one article at a time
  Template.article.rendered = function() {
    $(document).off('selectionchange');
    $(document).on('selectionchange', function(e, t) {
      getSelectionRange(function(range) {
        var id = $(range.startContainer).parents('.fragment-text').first().attr('data-id');
        if(id && (range.startOffset > 0 || range.endOffset > 0))
        {
          savedRanges[id] = { start: range.startOffset, end: range.endOffset };
        }
        else if(id) {
          //savedRanges[id] = { start: 0, end: 0 };
        }
      });
    });
    $(document).on('keydown', function(e) {
      if(((e.ctrlKey || e.metaKey) && (e.which == 83 || e.which == 115)) || e.which == 27) {
        Session.set('editing', false);
        e.preventDefault();
        return false;
      }
    });

    this.$('.fragments').sortable({
      helper: '.options',
      cancel: '[contenteditable]',
      stop: function(event, ui) {
        if(Session.get('editing'))
        {
          updateDocumentFragments();
        }
      },
      start: function(event, ui) {
        $('.fragments').sortable("option", "disabled", !Session.get('editing'))
      }
    }).enableSelection().on('click', function(event, ui) {
      if(event.target)
      {
        //TODO: Currently losing clicked-caret-position with this focus call (and not restoring saved)
        $(event.target).focus();
      }
    });
    //setupAutorun();
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
      var x = 0, y = 0, start = 0, end = 0;
      if (sel) {
          if (sel.type != "Control") {
              range = sel.createRange();
              range.collapse(true);
              x = range.boundingLeft;
              y = range.boundingTop;
              start = range.startOffset||0;
              end = range.endOffset||0;
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
                  start = range.startOffset;
                  end = range.endOffset;
                }
                else
                {
                  x = 0;
                  y = 0;
                  start = false;
                  end = false;
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
      return { x: x, y: y, start: start, end: end };
  }
  function highestOf(a, b) {
    return (a > b ? a : b);
  }
  function insertTextAtCursor(text) {
    var sel, range, html;
    if (window.getSelection) {
        sel = window.getSelection();
        if (sel.getRangeAt && sel.rangeCount) {
            range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode( document.createTextNode(text) );
        }
    } else if (document.selection && document.selection.createRange) {
        document.selection.createRange().text = text;
    }
  }

  var arrows = {
    37: "left",
    38: "up",
    39: "right",
    40: "down",
  };
  var startText = false;
  Template.fragment.events({
    /*'change .fragment-text': function(e, t) {
      console.log('changed');
    },*/
    'paste .fragment-text': function(e, t) {
      //Safely parsing html/markup/scripts is a LOT more complicated, tackle it if you dare :)
      var text = (e.originalEvent || e).clipboardData.getData('text/plain');
      if(text && typeof(text) == 'string' && text.trim())
      {
        e.preventDefault();
        insertTextAtCursor(text);
      }
    },
    'dblclick .fragment-text': function(e, t) {
      Session.set('editing', true);
      $('.fragments').sortable("option", "disabled", !Session.get('editing'))
    },
    'focus .fragment-text': function(e, t) {
      var fragment = $(t.find('.fragment-text'));
      startText = fragment.text();
      fragment.parents('.fragment-container').attr('focussed', 'true');
      //$(e.currentTarget).attr('contenteditable', true);
    },
    'blur .fragment-text': function(e, t) {
      var fragment = $(t.find('.fragment-text'));
      fragment.parents('.fragment-container').removeAttr('focussed');
      var newText = fragment.text();
      var tag = this.tag;

      var firstText = newText, allTexts = [];
      if(newText)
      {
        if(firstText.indexOf("\n") > -1)
        {
          allTexts = newText.trim().replace(/[\r\n]+/, '\n').split('\n');
          firstText = (allTexts[0]||'').trim();
        }
        else
        {
          firstText = newText;
        }
      }
      
      if(firstText != startText || !startText)
      {
        if(tag == 'hr' && !firstText)
        {
          firstText = '-';
        }
        if(!firstText)
        {
          if(this._id)
          {
            if($('.fragment-container').length > 1)
            {
              updateDocumentFragments(this._id, true);
              Fragments.remove({ _id: this._id });
            }
          }
        }
        else
        {
          Fragments.update({_id: this._id}, { $set: { text: firstText }});
          updateDocumentFragments(undefined, undefined, (globalFragmentIds||[]).indexOf(fragment.attr('data-id')));

          //bodges around meteor concatenating session values to div content on rerender (okay here because we're not listening on changed event)
          fragment.text('');
        }
      }
      else
      {
        fragment.text(startText);
      }

      if(allTexts && allTexts.length > 1)
      {
        var adding = 0;
        for(var i = 1; i < allTexts.length; i++)
        {
          var currText = allTexts[i] && allTexts[i].trim();
          if(currText)
          {
            var chainedFragmentIds = [];
            (function(fragmentId, offset) {
              var position = (globalFragmentIds||[]).indexOf(fragmentId)+1;//+offset;
              var articleId = $('.fragments').attr('data-id');

              Fragments.insert({ text: currText, articleId: articleId, tag: (this.tag == 'tag' ? this.tag : 'p') }, function(err, id) {
                chainedFragmentIds.push(id);
                if((offset+1) == chainedFragmentIds.length)
                {
                  updateDocumentFragments(chainedFragmentIds, false, position);
                }
              });
            })(fragment.attr('data-id'), adding);
            adding++;
          }
        }
      }

      startText = false;
      ctrlIsDown = false;
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
        var el = $(e.target);
        var coords = getSelectionCoords();
        var offset = el.offset();
        var scrollTop = $(window).scrollTop(), scrollLeft = $(window).scrollLeft();//This may not play well inside iframes
        var height = el.height(), width = el.width(), top = coords.y - offset.top + scrollTop, left = coords.x - offset.left + scrollLeft;

        var lineHeight = highestOf(parseInt(el.css('line-height')), parseInt(el.css('font-size')));
        var lineHeightModifier = 1.5;

        if((dir == "up" && top <= 2) ||
          (dir == "down" && top >= (height - (lineHeight * lineHeightModifier))))
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
            var nextId = nextText.attr('data-id');
            if(savedRanges && savedRanges[nextId])
            {
              restoreRange(nextText.get(0), nextId);
            }
            else
            {
              nextText.focus();
            }
            return false;
          }
        }
        else
        {
          if(dir == 'left' && (left <= 2 || (this.tag == 'q' && left < 7) || (this.tag == 'bq' && left < 27)))
          {
            //TODO: Currently setting next available objects in code, but could be cleverer about what grabs focus next.
            var parent = el.parent();
            var typeEl = parent.find('.fragment-set-tag .selectpicker');

            var el = typeEl.get(0);
            if(el)
            {
              var evt = document.createEvent('UIEvents');
              evt.initUIEvent("click", true, true, window, 1);
              el.dispatchEvent(evt);
              parent.attr('focussed', 'true');
            }
            return false;
          }
        }
      }
    },
    'keyup .fragment-text': function(e, t) {
      //console.log(e.keyCode);
      //console.log(e.which);
      //TODO: Catch backspace at start for joining this fragment to previous one, and delete at end for joining next fragment to this one
      if(e.keyCode == 13)
      {
        //TODO: If caret is between text (has before and after), edit fragment, and create new fragment at next position with 'after' text
        //TODO: If caret is selection, remove selection from fragment and create fragment in next position
        var nextText = $(e.target).parent().next().find('.fragment-text').first();
        if(!(nextText && nextText.length > 0) || ctrlIsDown)
        {
          var position = false;
          //Use ctrl+enter to insert after the current fragment
          if(ctrlIsDown) {
            position = (globalFragmentIds||[]).indexOf($(e.target).attr('data-id'))+1;
          }
          var articleId = $('.fragments').attr('data-id');//TODO: Support displaying multiple articles in a single page/view t.parent.something

          Fragments.insert({ text: '', articleId: articleId, inline: !!this.inline, tag: (this.tag == 'tag' ? this.tag : 'p') }, function(err, id) {
            updateDocumentFragments(id, false, position);
          });
        }
        else
        {
          nextText.focus();
        }
        return false;
      }
      else if(e.keyCode == 27)
      {
        getSelectionRange(function(range) {
          if(range && range.startOffset === 0 && range.endOffset === 0)
          {
            Session.set('editing', false);
          }
        });
        return false;
      }
      else if(e.keyCode == 9) {
        restoreRange(e.currentTarget, this._id);
      }
      else if(e.keyCode == 73 && ctrlIsDown) {
        var el = $(e.target);
        var id = el.attr('data-id');

        Fragments.update({ _id: id }, { $set: { inline: !this.inline }});
      }
    },
    'keypress .fragment-text': function(e, t) {
      //console.log(e.which, e.ctrlKey, e.metaKey);
      if(e.which == 34 && this.tag != 'q' && this.tag != 'bq')
      {
        var el = $(e.target);
        var id = el.attr('data-id');
        if(el.text().length <= 1) {
          Meteor.setTimeout(function() {
            if(el.text() == "\"") {
              Fragments.update({ _id: id }, { $set: { tag: 'q' }}, function(err, changed) {
                if(changed) {
                  Meteor.defer(function() {
                    $('.fragment-text[data-id="'+id+'"]').focus().text('').select();
                  });
                }
              });
            }
          }, 250);
        }
      }
    },
    'change .fragment-set-tag': function(e, t) {
      var tag = $(e.target).val();
      Fragments.update({_id: this._id}, {$set: {tag: tag}});

      Meteor.setTimeout(function() {
        var nextText = $(t.find('.fragment-text'));
        nextText.focus();
      }, 20);
    }
  });

  function onTagTypeRefresh(e, t) {
    var container = $('.fragment-container[data-id="' + this.data._id + '"]');
    container.find('.fragment-set-tag').selectpicker('refresh');

    var frag = Session.get('frag');
    if(frag && frag == this.data._id) {
      var offset = container.offset();
      if (offset){
        $('html, body').animate({scrollTop: offset.top}, 400);
        Session.set('frag', null);
      }
    }
    //container.find('.fragment-text').focus();
  }

  //Bind refresh of the non-reactive select when tagtype is changed remotely
  Template.fragmenttagpath.rendered = 
  Template.fragmenttagmeta.rendered = 
  Template.fragmenttagtag.rendered = 
  Template.fragmenttaghr.rendered = 
  Template.fragmenttagtable.rendered = 
  Template.fragmenttagspan.rendered = 
  Template.fragmenttagquote.rendered = 
  Template.fragmenttagblockquote.rendered = 
  Template.fragmenttagh4.rendered = 
  Template.fragmenttagh3.rendered = 
  Template.fragmenttagh2.rendered = 
  Template.fragmenttagh1.rendered = 
  Template.fragmenttagp.rendered = onTagTypeRefresh; //TODO: Define these from supportedTags array

  Template.fragmenttagpath.canonical = function(e, t) {
    //TODO: Get article id, get article title, build path, and navigate to it
    console.log('build canonical url for', this._id, this.text);
  };
  Template.fragment.inline = function(e, t) {
    return this.inline ? 'true' : 'false';
  };
  Template.fragment.tag = function(e, t) {
    return this.tag||'p';
  };
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
  Template.articleLink.linkUrl = function() {
    return Router.routes['article'].url({_id: this._id});
  }
  Template.articleLink.linkText = function() {
    return this.title||this._id;
  }

}