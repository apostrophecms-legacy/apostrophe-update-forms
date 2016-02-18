/* jshint node:true */

var _ = require('lodash');
var async = require('async');

module.exports = forms;

function forms(options, callback) {
  return new forms.Forms(options, callback);
}

var snippets = require('apostrophe-snippets');

forms.Forms = function(options, callback) {
  var self = this;
  self._pages = options.pages;
  self._apos = options.apos;
  self._schemas = options.schemas;

  // bodyControls, addBodyControls, removeBodyControls are supported
  // (if you use the first one, the other two are ignored)
  resolveControls('body');

  // Same idea
  resolveControls('thanks');

  options.addFields = [
    {
      name: 'body',
      label: 'Instructions',
      type: 'area',
      options: {
        controls: options.bodyControls
      }
    },
  ].concat([ getTypeSelectorField() ])
  .concat(getTypeWhichFields())
  .concat(getTypeArrayFields())
  .concat([
    {
      name: 'thanks',
      label: 'Thank You Message',
      type: 'area',
      options: {
        controls: options.thanksControls
      }
    }
  ]);

  console.log(JSON.stringify(options.addFields, null, '  '));

  options.removeFields = [ 'hideTitle', 'thumbnail' ].concat(options.removeFields || []);

  _.defaults(options, {
    name: 'updateForms',
    label: 'Update Forms',
    instance: 'updateForm',
    instanceLabel: 'Update Form',
    menuName: 'aposUpdateFormsMenu',
  });

  snippets.Snippets.call(this, options, null);
  self._apos.mixinModuleEmail(self);

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
        return {
          value: typeName,
          label: manager.instanceLabel,
          showFields: [ typeName + 'Fields' ]
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

  function getTypeWhichFields() {
    var typeNames = _.keys(options.types);
    return _.map(typeNames, function(typeName) {
      return {
        type: 'select',
        name: typeName + 'Which',
        choices: [
          {
            label: 'All Fields of This Type',
            value: 'all'
          },
          {
            label: 'Certain Fields',
            value: 'some',
            showFields: [ typeName + 'Fields' ]
          }
        ]
      };
    });
  }

  function getTypeArrayFields() {
    var typeNames = _.keys(options.types);
    return _.map(typeNames, function(typeName) {
      var schema = getSubset(typeName);
      var groups = _.filter(schema, { type: 'group' });
      var fieldsByGroup = {};
      _.each(groups, function(group) {
        fieldsByGroup[group.name] = _.filter(schema, { group: group.name });
      });
      return {
        name: typeName + 'Fields',
        type: 'array',
        label: 'Editable Fields',
        schema: [
          {
            type: 'select',
            name: 'group',
            label: 'Field Type',
            required: true,
            choices: [
              {
                label: 'CHOOSE ONE',
                value: ''
              }
            ].concat(_.map(groups, function(group) {
              return {
                label: group.label,
                value: group.name,
                showFields: [ group.name + 'Field' ]
              };
            })),
            required: true
          }
        ].concat(_.map(fieldsByGroup, function(fields, groupName) {
          return {
            type: 'select',
            name: groupName + 'Field',
            label: 'Field Name',
            required: true,
            choices: [
              {
                label: 'CHOOSE ONE',
                value: ''
              },
              {
                label: 'ALL fields of this type',
                value: 'ALL'
              }
            ].concat(
              _.map(fields, function(field) {
                return {
                  label: field.label,
                  value: field.name
                };
              })
            )
          };
        }))
      };
    });
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

  process.nextTick(_.partial(callback, null));

};
