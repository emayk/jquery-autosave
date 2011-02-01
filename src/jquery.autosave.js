/**
 * @fileOverview jQuery.autosave
 *
 * @author Kyle Florence
 * @website https://github.com/kflorence/jquery-autosave
 * @version 1.0.1b
 *
 * Inspired by the jQuery.autosave plugin written by Raymond Julin,
 * Mads Erik Forberg and Simen Graaten.
 *
 * Dual licensed under the MIT and BSD Licenses.
 */
;(function($, undefined) {
  var extend = $.extend;

  /**
   * Fixes jQuery.extend bugs for jQuery versions less than 1.4
   * This particular version is from jQuery core 1.4.4
   *
   * TODO: try to narrow this down
   */
  if (!$.isPlainObject) {
    var class2type = {}, hasOwn = Object.prototype.hasOwnProperty;
    $.each("Boolean Number String Function Array Date RegExp Object".split(" "), function(i, name) {
      class2type["[object " + name + "]"] = name.toLowerCase();
    });

    var type = function(obj) {
        return obj == null ?
          String(obj) : class2type[toString.call(obj)] || "object";
      }, isWindow = function(obj) {
        return obj && typeof obj === "object" && "setInterval" in obj;
      }, isArray = Array.isArray || function(obj) {
        return type(obj) === "array";
      }, isPlainObject = function(obj) {
        if (!obj || type(obj) !== "object" || obj.nodeType || isWindow(obj)) {
          return false;
        }
        if (obj.constructor &&
          !hasOwn.call(obj, "constructor") &&
          !hasOwn.call(obj.constructor.prototype, "isPrototypeOf")) {
          return false;
        }
        var key;
        for (key in obj) {}
        return key === undefined || hasOwn.call(obj, key);
      };

    extend = function() {
      var options, name, src, copy, copyIsArray, clone, target = arguments[0]
        || {}, i = 1, length = arguments.length, deep = false;

      if (typeof target === "boolean") {
        deep = target; target = arguments[1] || {}; i = 2;
      }

      if (typeof target !== "object" && !jQuery.isFunction(target)) {
        target = {};
      }

      if (length === i) {
        target = this; --i;
      }

      for (; i < length; i++) {
        if ((options = arguments[i]) != null) {
          for (name in options) {
            src = target[name]; copy = options[name];
            if (target === copy) continue;
            if (deep && copy && (isPlainObject(copy)
              || (copyIsArray = isArray(copy)))) {
              if (copyIsArray) {
                copyIsArray = false;
                clone = src && isArray(src) ? src : [];
              } else {
                clone = src && isPlainObject(src) ? src : {};
              }
              target[name] = extend(deep, clone, copy);
            } else if (copy !== undefined) target[name] = copy;
          }
        }
      }

      return target;
    };
  }

  /**
   * Fixes binding the "change" event to checkboxes and select[type=multiple]
   * for Internet Explorer. See: https://gist.github.com/770449
   *
   * @param {String} eventType
   *    The name of the event we want to bind to.
   *
   * @param {Element} element
   *    The DOM Element we wish to bind the event to.
   *
   * @param {function} callback
   *    The function to execute when the event is triggered
   */
  var bind = function(eventType, element, callback) {
    if (eventType !== "change") $(element).bind(eventType, callback);
    else {
      eventType = (element.type == "checkbox"
        || element.tagName.toLowerCase() == "select" && element.multiple)
        && ("onpropertychange" in document.body) ? "propertychange" : "change";

      $(element).bind(eventType, function(e) {
        if (e.type == "change" || (e.type == "propertychange"
          && /^(checked|selectedIndex)$/.test(window.event.propertyName))) {
          callback.call(this, e);
        }
      });
    }
  };

  /**
   * Attaches an autosave class instance to the form elements associated with
   * the elements passed into the plugin.
   *
   * @param {Object} [options]
   *    User supplied options to override the defaults within the plugin.
   *
   * @returns {jQuery}
   *    The elements that invoked this function.
   */
  $.fn.autosave = function(options) {
    var instance = extend({}, $.autosave);

    // Initialize this instance
    instance.initialize(this, options);

    // Don't break the chain
    return this;
  };

  /**
   * @class The jQuery.autosave class.
   */
  $.autosave = {
    /**
     * The ID of the currently running timer, or undefined if there isn't one.
     */
    timer: 0,
    /**
     * This jQuery object will hold our save method queue.
     */
    $queue: $({}),
    /**
     * Default plugin options.
     */
    options: {
      /**
       * The namespace to append after event names and before class names that
       * are used within the plugin.
       */
      namespace: "autosave",
      /**
       * Contains a set of key/value pairs that represent the steps of the
       * saving process.
       */
      save: {
        /**
        * Events that will start the saving process.
        */
        trigger: "change",
        /**
        * Reduces the scope of form fields involved in the save.
        */
        scope: false,
        /**
         * Determine how to extract and store the form field values.
         */
        data: false,
        /**
        * Determine whether or not to autosave based on certain conditions.
        */
        condition: false,
        /**
        * An array of callback methods that will determine how the form field
        * data will be saved.
        */
        method: "ajax"
      },
      /**
      * Contains a set of key/value pairs that allow you to change the name of
      * events used within the plugin. Keep in mind that these events will be
      * namespaced on initialization like: "eventName.autosave"
      */
      events: {
        /**
         * This event is attached to each form autosave is attached to. When
         * triggered, it will attempt to save the form.
         */
        save: "save",
        /**
         * This event is triggered on each form whenever autosave finishes
         * saving form data. It can be bound to if you need to be notified
         * after saving is completed.
         */
        saved: "saved"
      },
      /**
       * Contains a set of key/value pairs that allow you to change the name of
       * classes used within the plugin. Keep in mind that these classes will be
       * namespaced on initialization like: "autosave-className"
       */
      classes: {
        /**
         * The class name that will be applied to elements whose value has been
         * changed but not yet saved.
         */
        changed: "changed",
        /**
         * Fields with this class name will be ignored by the plugin when
         * gathering data.
         */
        ignore: "ignore"
      }
    },

    /**
     * Initializes the plugin.
     *
     * @param {jQuery} $original
     *    The original elements passed to the plugin.
     *
     * @param {Object} options
     *    The form fields found in the forms this plugin is attached to.
     */
    initialize: function($elements, options) {
      var self = this;

      // Store the selector used when invoking the plugin
      this.selector = $elements.selector;

      // Merge options
      this.options = extend(true, {}, this.options, options);

      // Set the forms and form fields associated with the plugin
      this.update();

      // If we have no forms or inputs to work on, return
      if (!this.$elements.length) return;

      // Add namespace to events
      $.each(this.options.events, function(name, eventName) {
        self.options.events[name]
          = [eventName, self.options.namespace].join(".");
      });

      // Add namespace to classes
      $.each(this.options.classes, function(name, className) {
        self.options.classes[name]
          = [self.options.namespace, className].join("-");
      });

      // Bind to each form field and listen for changes
      this.$fields.each(function() {
        bind("change", this, function(e) {
          $(this).addClass(self.options.classes.changed);
        });
      });

      // Bind the "save" event to each form
      this.$forms.bind(this.options.events.save, function(e) {
        self.save(this, e.type);
      });

      // Parse each save option and extract the callback methods
      $.each(this.options.save, function(key, value) {
        var validCallbacks = [];

        if (value) {
          // Store callback in an array, if it isn't one already
          if (!$.isArray(value)) value = [value];

          $.each(value, function(i, callback) {
            callback = self.getCallback(callback, self.callbacks[key]);

            // If callback has a valid method, we can use it
            if ($.isFunction(callback.method)) validCallbacks.push(callback);
          });
        }

        self.options.save[key] = validCallbacks;
      });

      // Set up save triggers
      $.each(this.options.save.trigger, function(i, trigger) {
        trigger.method.call(self, trigger.options);
      });
    },

    /**
     * Returns the forms and form fields associated with the given elements.
     *
     * @param {jQuery|Element|Element[]} elements
     *    The elements to extract forms and form fields from.
     *
     * @return {jQuery}
     *    A jQuery object containing the forms and/or form fields associated
     *    with the given elements.
     */
    getFormsAndFields: function(elements) {
      return $(elements).filter(function() {
        return (this.elements || this.form);
      });
    },

    /**
     * Returns the forms associated with the given elements.
     *
     * @param {jQuery|Element|Element[]} [elements]
     *    The elements to extract form fields from. Uses the default forms and
     *    fields detected on initialization by default.
     *
     * @returns {jQuery}
     *    A jQuery object containing the forms associated with the given
     *    elements.
     */
    getForms: function(elements) {
      return $($.unique($(elements || this.$elements).map(function() {
        return this.elements ? this : this.form;
      }).get()));
    },

    /**
     * Returns the form fields from the given elements.
     *
     * @param {jQuery|Element|Element[]} elements
     *    The elements to extract form fields from. Uses the default forms and
     *    fields detected on initialization by default.
     *
     * @returns {jQuery}
     *    A jQuery object containing the form fields associated with the
     *    given elements.
     */
    getFields: function(elements) {
      return $(elements || this.$elements).map(function() {
        return this.elements ? $.makeArray(this.elements) : this;
      });
    },

    /**
     * Returns all of the valid form fields from the given elements.
     *
     * @param {jQuery|Element|Element[]} [fields]
     *    The fieldss to extract valid form fields from. Uses the default
     *    fields detected on initialization by default.
     *
     * @returns {jQuery}
     *    A jQuery object containing the fields.
     */
    getValidFields: function(fields) {
      var self = this;

      return $(fields || this.$fields).filter(function() {
        return !$(this).hasClass(self.options.classes.ignore);
      });
    },

    /**
     * Get all of the fields whose value has changed since the last save.
     *
     * @param {jQuery|Element|Element[]} [fields]
     *    The fields to extract changed fields from. Uses the default fields
     *    detected on initialization by default.
     *
     * @returns {jQuery}
     *    A jQuery object containing the fields.
     */
    getChangedFields: function(fields) {
      return $(fields || this.$fields).filter("." + this.options.classes.changed);
    },

    /**
      * Get a callback method from a list of methods.
      *
      * @param {String|Object|function} method
      *    The method to get. Can be a string or object that represents one of
      *    the built in callback methods, or a custom function to use instead.
      *
      * @param {Object} methods
      *    An object containing the list of methods to search in.
      *
      * @returns {Object}
      *    The callback object. This will be an empty object if the callback
      *    could not be found. If it was found, this object will contain at the
      *    very least a "method" property and potentially an "options" property.
      */
    getCallback: function(method, methods) {
      var callback = {}, methodType = typeof method;

      if (methodType === "function") {
        // Custom function with no options
        callback.method = method;
      } else if (methodType === "string" && method in methods) {
        // Built in method, use default options
        callback = methods[method];
      } else if (methodType === "object") {
        callback = method, methodType = typeof callback.method;

        if (methodType === "string" && callback.method in methods) {
          // Built in method
          callback = methods[callback.method];

          if (typeof method.options === "object") {
            // Merge in user supplied options with the defaults
            callback.options = extend(true, {}, callback.options, method.options);
          } else {
            // Set options up as an empty object if none are found
            callback.options = {};
          }
        }
      }

      return callback;
    },

    /**
     * Starts an autosave interval loop, stopping the current one if needed.
     *
     * @param {number} interval
     *    An integer value representing the time between intervals in
     *    milliseconds.
     */
    startInterval: function(interval) {
        var self = this;

        interval = interval || this.interval;

        // If there is a timer running, stop it
        if (this.timer) this.stopInterval();

        // Make sure we have a valid interval
        if (!isNaN(parseInt(interval))) {
          this.timer = setTimeout(function() {
            self.save(false, self.timer);
          }, interval);
        }
    },

    /**
     * Stops an autosave interval loop.
     */
    stopInterval: function() {
      clearTimeout(this.timer);
      this.timer = null;
    },

    /**
     * Updates the forms and fields used by this instance based on the
     * original selector that was passed into the plugin.
     */
    update: function() {
      // Remove autosave instance from old elements, if any exist
      if (this.$elements && this.$elements.length) {
        this.$elements.removeData("autosave");
      }

      // Update the forms and form fields associated with the selector
      this.$elements = this.getFormsAndFields(this.selector);

      // Attach an instance to those elements
      this.$elements.data("autosave", this);

      // Store all of the found forms and fields
      this.$forms = this.getForms(this.$elements);
      this.$fields = this.getFields(this.$elements);
    },

    /**
     * Attemps to save form field data.
     *
     * @param {jQuery|Element|Element[]} [fields]
     *    The form fields to extract data from. Can be of type jQuery, a DOM
     *    element, or an array of DOM elements. If no fields are passed, the
     *    fields passed to the plugin on initialization will be used.
     *
     * @param {mixed} [caller]
     *    Used to denote who called this function. If passed, it is typically
     *    the ID of the current interval timer and may be used to check if the
     *    timer called this function.
     */
    save: function(fields, caller) {
      var self = this, saved = false;

      // Make sure we have the latest information
      this.update();

      // Use all fields by default
      fields = fields || this.$fields;

      // If there are no save methods defined, we can't save
      if (this.options.save.method.length) {
        var $fields = this.getValidFields(fields);

        // Continue filtering the scope of fields
        $.each(this.options.save.scope, function(i, scope) {
          $fields = scope.method.call(self, scope.options, $fields);
        });

        if ($fields.length) {
          var passes = true, formData = $fields.serializeArray();

          // Manipulate form data
          $.each(this.options.save.data, function(i, data) {
              formData = data.method.call(self, data.options, $fields, formData);
          });

          // Loop through pre-save conditions and proceed only if they pass
          $.each(this.options.save.condition, function(i, condition) {
            return (passes = condition.method.call(
              self, condition.options, $fields, formData, caller
            )) !== false;
          });

          if (passes) {
            // Add all of our save methods to the queue
            $.each(this.options.save.method, function(i, save) {
              self.$queue.queue("saveMethodQueue", function() {
                // Methods that return false should handle the call to complete()
                if (save.method.call(self, save.options, formData) !== false) {
                  self.complete();
                }
              });
            });

            // We were able to save
            saved = true;
          }
        }
      }

      // Start the dequeue process
      this.complete(saved);
    },

    /**
     * Called whenever a save method completes; performs necessary cleanup.
     *
     * @param {Boolean} resetChanged
     *    Whether or not to reset which elements were changed before saving.
     *    Defaults to true.
     */
    complete: function(resetChanged) {
      var queue = this.$queue.queue("saveMethodQueue");

      // Dequeue the next function if queue is not empty
      if (queue && queue.length) this.$queue.dequeue("saveMethodQueue");

      // If queue is empty, we are done saving
      if (queue && !queue.length) {
        this.$forms.triggerHandler(this.options.events.saved);
      }

      // Queue does not exist or is empty, proceed to cleanup
      if (!queue || !queue.length) {
        // Reset changed by default
        if (resetChanged !== false) {
          this.$fields.removeClass(this.options.classes.changed);
        }

        // If there is a timer running, start the next interval
        if (this.timer) this.startInterval();
      }
    }
  };

  /**
   * Callback repository
   */
  var callbacks = $.autosave.callbacks = {};
  $.each($.autosave.options.save, function(key) {
    callbacks[key] = {};
  });

  /**
   * Add built-in save trigger callbacks
   */
  extend(callbacks.trigger, {
    /**
     * Attempt to save any time a form field value changes.
     */
    change: {
      method: function(options) {
        var self = this,
          $fields = options.filter ? this.$fields.filter(options.filter)
            : this.$fields;

        $fields.each(function() {
          bind("change", this, function(e, field) {
            self.save(field, e.type);
          });
        });
      },
      options: {
        filter: false
      }
    },
    /**
      * Attempt to save any time an event occurs on some element.
      */
    event: {
      method: function(options) {
        var self = this, $element = $(options.element);

        if (typeof options.eventType === "string") {
          $element.each(function() {
            bind(options.eventType, this, function(e) {
              self.save(false, e.type);
            });
          });
        }
      },
      options: {
        element: ".autosave-save",
        eventType: "click"
      }
    },
    /**
      * Creates an interval loop that will attempt to save periodically.
      */
    interval: {
      method: function(options) {
        if (!isNaN(parseInt(options.interval))) {
          this.startInterval(this.interval = options.interval);
        }
      },
      options: {
        interval: 30000
      }
    }
  });

  extend(callbacks.scope, {
    /**
     * Changes the scope of fields to only those whose value has changed
     * since the last autosave.
     */
    changed: {
      method: function() {
        return this.getChangedFields();
      }
    }
  });

  extend(callbacks.data, {
    /**
     * Whereas .serializeArray() serializes a form into an array,
     * .serializeObject() serializes a form into an object.
     *
     * jQuery serializeObject - v0.2 - 1/20/2010
     * http://benalman.com/projects/jquery-misc-plugins/
     *
     * Copyright (c) 2010 "Cowboy" Ben Alman
     * Dual licensed under the MIT and GPL licenses.
     * http://benalman.com/about/license/
     *
     * @return Object The resulting object of form values.
     */
    serializeObject: {
      method: function(options, $fields) {
        var obj = {};

        $.each($fields.serializeArray(), function(i, o) {
          var n = o.name, v = o.value;

          obj[n] = obj[n] === undefined ? v
            : $.isArray(obj[n]) ? obj[n].concat(v)
            : [obj[n], v];
        });

        return obj;
      }
    }
  });

  extend(callbacks.condition, {
    /**
     * Only save if the interval called the save method
     */
    interval: {
      method: function(options, $fields, data, caller) {
        return (!this.timer || this.timer === caller);
      }
    },
    /**
     * Only save if at least one of the field values has changed
     */
    changed: {
      method: function() {
        return this.getChangedFields().length > 0;
      }
    }
  });

  extend(callbacks.method, {
    /**
     * Saves form field data using a jQuery.ajax call. Any options that can
     * be passed to the jQuery.ajax method are valid here.
     */
    ajax: {
      method: function(options, data) {
        var self = this;

        $.ajax($.extend(true, { data: data }, options, {
          complete: function(xhr, status) {
            if ($.isFunction(options.complete)) {
              // Call user-provided complete function first
              options.complete.apply(self, arguments);
            }

            // We are done now, cleanup
            self.complete();
          }
        }));

        // Don't call this.complete() yet
        return false;
      },
      options: {
        url: window.location.href,
        type: "POST"
      }
    }
  });
})(jQuery);
