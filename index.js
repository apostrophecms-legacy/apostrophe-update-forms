/* jshint node:true */

var _ = require('lodash');
var async = require('async');
var csv = require('csv-stringify');
var qs = require('qs');

module.exports = updateForms;

function updateForms(options, callback) {
  return new updateForms.UpdateForms(options, callback);
}

var snippets = require('apostrophe-snippets');

updateForms.UpdateForms = function(options, callback) {
  var self = this;
  self._pages = options.pages;
  self._apos = options.apos;
  self._schemas = options.schemas;

  // bodyControls, addBodyControls, removeBodyControls are supported
  // (if you use the first one, the other two are ignored)
  resolveControls('body');

  // Same idea
  resolveControls('thanks');

  // Too much potential for havoc
  options.adminOnly = true;

  options.addFields = [
    {
      name: 'body',
      label: 'Instructions',
      type: 'area',
      options: {
        controls: options.bodyControls
      }
    },
    {
      name: 'thanks',
      label: 'Thank You Message',
      type: 'area',
      options: {
        controls: options.thanksControls
      }
    }
  ].concat([ getTypeSelectorField() ])
  .concat(getTypeFields());

  options.removeFields = [ 'hideTitle', 'thumbnail' ].concat(options.removeFields || []);

  _.defaults(options, {
    name: 'updateForms',
    label: 'Update Forms',
    instance: 'updateForm',
    instanceLabel: 'Update Form',
    menuName: 'aposUpdateFormsMenu',
  });

  options.modules = (options.modules || []).concat([ { dir: __dirname, name: 'update-forms' } ]);

  snippets.Snippets.call(this, options, null);
  self._apos.mixinModuleEmail(self);

  self._app.get(self._action + '/mail-merge', function(req, res) {

    var baseUrl = req.protocol + '://' + req.get('Host') + self._apos.prefix;

    var form;
    var objects;
    var mergeKeys = {};
    var joinType;
    var typeOptions;
    var mailMerge;
    var fieldDefinition;

    return async.series([ getForm, getObjects, getPeople, setMergeKeys ], function(err) {
      if (err) {
        console.error(err);
        res.statusCode = 404;
        return res.send('not found');
      }
      var data = [];
      data.push(self.getMailMergeHeadings());

      _.each(objects, function(object) {
        if (!_.has(mergeKeys, object._id)) {
          return;
        }
        data.push(self.getMailMergeRow(object, baseUrl, mergeKeys ));
      });
      res.attachment('mail-merge.csv');
      return csv(data, function(err, s) {
        if (err) {
          console.error(err);
          res.statusCode = 404;
          return res.send('not found');
        }
        return res.send(s);
      });
    });

    function getForm(callback) {
      return self.getOne(req, { _id: self._apos.sanitizeId(req.query.id) }, { editable: true }, function(err, _form) {
        if (err) {
          return callback(err);
        }
        form = _form;
        typeOptions = options.types[form.snippetType];
        mailMerge = typeOptions.mailMerge || {};

        if (mailMerge.getPeople) {
          joinType = 'joinByGetPeople';
        } else if (mailMerge.personField) {
          joinType = 'joinByPersonField';
        } else if (mailMerge.field) {
          joinType = 'joinByOne';
        } else {
          joinType = 'joinByPermissions';
        }

        if (joinType === 'joinByOne') {
          fieldDefinition = _.find(manager.schema, { name: mailMerge.field });
          if ((!fieldDefinition) || (fieldDefinition.type !== 'joinByOne')) {
            return callback('field option used, personField option not used, and field option is not joinByOne');
          }
        }
        return callback(null);
      });
    }

    function getObjects(callback) {
      var fields = { title: 1, pagePermissions: 1 };
      if (joinType === 'joinByPersonField') {
        fields[mailMerge.field] = 1;
      } else if (joinType === 'joinByOne') {
        fields[fieldDefinition.idField] = 1;
      }
      return self._pages.getManager(form.snippetType).get(req, {}, { published: null, fields: fields, withJoins: false, areas: false }, function(err, results) {
        if (err) {
          return callback(err);
        }
        objects = results.pages || results.snippets;
        return callback(null);
      });
    }

    function getPeople(callback) {

      if (joinType === 'joinByGetPeople') {
        return mailMerge.getPeople(req, objects, callback);
      }

      var criteria = {};
      var manager = self._pages.getManager(form.snippetType);
      if (!typeOptions) {
        return callback('type no longer configured');
      }

      var fields = { firstName: 1, lastName: 1, email: 1, title: 1 };
      if (joinType === 'joinByPersonField') {
        fields[mailMerge.personField] = 1;
      }

      if (joinType === 'joinByPermissions') {
        criteria = { _id: { $in: [] } };
        _.each(objects, function(object) {
          _.each(object.pagePermissions || [], function(p) {
            var matches = p.split(/\-/);
            if (!(matches && (matches[0] === 'edit') && matches[1])) {
              return;
            }
            criteria._id.$in.push(matches[1]);
          });
        });
      } else if (joinType === 'joinByPersonField') {
        var personFieldValues = _.pluck(objects, mailMerge.field);
        criteria = {};
        criteria[mailMerge.personField] = { $in: personFieldValues };
      } else if (joinType === 'joinByOne') {
        var personIds = _.pluck(objects, fieldDefinition.idField);
        criteria = { _id: { $in: personIds } };
      }

      return self._pages.getManager('person').get(req, criteria, { published: null, fields: fields, withJoins: false, areas: false }, function(err, results) {

        if (err) {
          return callback(err);
        }

        var people = results.snippets;

        if (joinType === 'joinByPermissions') {
          var peopleById = _.indexBy(people, '_id');
          _.each(objects, function(object) {
            _.each(object.pagePermissions || [], function(permission) {
              var matches = permission.split(/\-/);
              if (matches && matches[1] && _.has(peopleById, matches[1])) {
                object._person = peopleById[matches[1]];
                return false;
              }
            });
          });
        } else if (joinType === 'joinByPersonField') {
          var peopleByField = _.indexBy(people, mailMerge.personField);
          _.each(objects, function(object) {
            if (_.has(peopleByField[object[mailMerge.field]])) {
              object._person = peopleByField[object[mailMerge.field]];
            }
          });
        } else if (joinType === 'joinByOne') {
          var peopleById = _.indexBy(people, '_id');
          _.each(objects, function(object) {
            if (_.has(peopleById[object[fieldDefinition.idField]])) {
              object._person = peopleById[object[fieldDefinition.idField]];
            }
          });
        }

        return callback(null);
      });
    }

    function setMergeKeys(callback) {
      var interesting = _.filter(objects, function(object) {
        return object._person;
      });
      return async.eachLimit(interesting, 4, function(object, callback) {
        var mergeKey = form._id + ',' + object._id + ',' + object._person._id + ',' + self._apos.generateId();
        mergeKeys[object._id] = mergeKey;
        return self._apos.pages.update(
          { _id: object._person._id },
          { $push: { updateFormsMergeKeys: mergeKey } },
          callback
        );
      }, callback);
    }

  });

  // One route to both display and save the form, since they have
  // so many shared prerequisites

  self._app.all(self._action + '/complete-form', function(req, res) {
    var mergeKey = self._apos.sanitizeString(req.query.mergeKey);
    var formId, objectId, personId, passcode;
    var parts = mergeKey.split(/,/);
    formId = parts[0];
    objectId = parts[1];
    personId = parts[2];
    passcode = parts[3];
    var originalSlug;
    var person, form, object, schema;
    // Make sure we get schema related js in browser
    req.scene = 'user';
    return async.series([ getPerson, getForm, getObject ], function(err) {
      if (err) {
        console.error(err);
        return res.send(self.renderPage(req, 'notfound', {}));
      } else {
        schema = flattenFormFields();
        if (req.method === 'GET') {
          return sendForm();
        } else {
          return saveForm();
        }
      }
    });

    function getPerson(callback) {
      return self._pages.getManager('person').getOne(req, { _id: personId }, { published: null, permissions: false }, function(err, _person) {
        if (err) {
          return callback(err);
        }
        if (!_person) {
          return callback('notfound');
        }
        if (!_.contains(_person.updateFormsMergeKeys, mergeKey)) {
          return callback('unauthorized');
        }
        person = _person;
        return callback(null);
      });
    }

    function getForm(callback) {
      return self.getOne(req, { _id: formId }, { permissions: false, published: true }, function(err, _form) {
        if (err) {
          return callback(err);
        }
        if (!_form) {
          return callback('not found');
        }
        form = _form;
        return callback(null);
      });
    }

    function getObject(callback) {
      return self._pages.getManager(form.snippetType).getOne(req, { _id: objectId }, { permissions: false }, function(err, _object) {
        if (err) {
          return callback(err);
        }
        if (!_object) {
          return callback('not found');
        }
        object = _object;
        originalSlug = object.slug;
        return callback(null);
      });
    }

    function flattenFormFields() {
      var schema = [];
      var originalSchema = self._pages.getManager(form.snippetType).schema;
      var groupNames = _.map(
        _.filter(
          originalSchema, { type: 'group' }
        ),
        function(group) {
          return group.name;
        }
      );
      var groupFieldListNames = _.map(groupNames, function(groupName) {
        return form.snippetType + groupName + 'Fields';
      });
      var fieldNames = [];
      _.each(groupFieldListNames, function(name) {
        fieldNames = fieldNames.concat(form[name]);
      });
      // We actually do want a flat schema, so don't use subset
      var flattenedSchema = _.map(fieldNames, function(name) {
        return _.find(originalSchema, { name: name });
      });
      // TODO One of the fields in this schema was returning undefined upon
      // flattening. This could be caused by some other issue, but omitting
      // that field seems to stop the bleeding. - Jimmy & Austin
      return _.filter(flattenedSchema, function(item) { return !!item; });
    }

    function sendForm() {
      return res.send(self.renderPage(
        req,
        'completeForm',
        {
          person: person,
          object: _.pick(object, _.pluck(schema, 'name'), 'title'),
          schema: schema,
          mergeKey: mergeKey,
          form: form,
          bodyOptions: _.find(self.schema, { name: 'body' }).options,
          thanksOptions: _.find(self.schema, { name: 'thanks' }).options
        }
      ));
    }

    function saveForm() {

      return async.series([ sanitize, save ], function(err) {
        if (err) {
          return res.send({ status: 'error' });
        } else {
          return res.send({ status: 'ok' });
        }
      });

      function sanitize(callback) {
        return self._schemas.convertFields(req, schema, 'form', req.body, object, callback);
      }

      function save(callback) {
        return self.saveForm(form.snippetType, req, originalSlug, object, callback);
      }

    }

  });

  function getTypeSelectorField() {
    var typeNames = _.keys(options.types);
    var choices = [
      {
        label: 'CHOOSE ONE',
        value: ''
      }
    ].concat(
      _.map(typeNames, function(typeName) {
        var manager = self._pages.getManager(typeName);
        var schema = getSubset(typeName);
        var groups = _.filter(schema, { type: 'group' });
        var groupNames = _.pluck(groups, 'name');
        var showFields = _.map(groupNames, function(groupName) {
          return typeName + groupName + 'Fields';
        });
        return {
          value: typeName,
          label: manager.instanceLabel,
          showFields: showFields
        };
      })
    );
    return {
      type: 'select',
      name: 'snippetType',
      label: 'Content Type',
      required: true,
      choices: choices
    };
  }

  function getTypeFields() {
    var fields = [];
    var typeNames = _.keys(options.types);
    _.each(typeNames, function(typeName) {
      var schema = getSubset(typeName);
      var groups = _.filter(schema, { type: 'group' });
      var fieldsByGroup = {};
      _.each(groups, function(group) {
        fieldsByGroup[group.name] = _.filter(schema, { group: group.name });
      });

      _.each(groups, function(group) {
        fields.push({
          type: 'checkboxes',
          label: group.label,
          name: typeName + group.name + 'Fields',
          choices: _.map(fieldsByGroup[group.name] || [], function(field) {
            return {
              label: field.label,
              value: field.name
            }
          })
        });
      });
    });
    return fields;
  }

  function resolveControls(areaName) {
    var add = 'add' + self._apos.capitalizeFirst(areaName) + 'Controls';
    var remove = 'remove' + self._apos.capitalizeFirst(areaName) + 'Controls';
    var controls = areaName + 'Controls';
    if (options[controls]) {
      return;
    }
    options[add] = [
      'style', 'bold', 'italic', 'createLink', 'unlink', 'insertUnorderedList', 'insertTable', 'slideshow', 'video'
    ].concat(options[add] || []);
    options[controls] = _.filter(options[add], function(name) {
      return !_.contains(options[remove] || [], name);
    });
  };

  function getSubset(typeName) {
    var schema = self._pages.getManager(typeName).schema;
    if (!schema) {
      throw new Error("No schema for " + typeName);
    }
    var config = options.types[typeName];
    var allowedFields = _.pluck(schema, 'name');
    if (config.allowedFields) {
      allowedFields = config.allowedFields;
    }
    if (config.allowedField) {
      allowedFields = _.filter(allowedFields, function(name) {
        return config.allowedField(_.find(schema, { name: name }));
      });
    }
    return self._schemas.subset(schema, allowedFields);
  }

  // Override me if you need special considerations when actually storing the updated object
  self.saveForm = function(type, req, slug, object, callback) {
    return self._pages.getManager(type).putOne(req, slug, { permissions: false }, object, callback);
  };

  self.getMailMergeHeadings = function() {
    return [ 'First Name', 'Last Name', 'Full Name', 'Email', 'Content', 'URL' ];
  };

  self.getMailMergeRow = function(object, baseUrl, mergeKeys) {
    return [
      object._person.firstName,
      object._person.lastName,
      object._person.title,
      object._person.email,
      object.title,
      baseUrl + self._action + '/complete-form?' + qs.stringify({
        mergeKey: mergeKeys[object._id]
      })
    ];
  };

  if (callback) {
    process.nextTick(_.partial(callback, null));
  }

};
