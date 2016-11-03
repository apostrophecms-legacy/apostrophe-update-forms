# apostrophe-update-forms

Helps your website's contributors update out-of-date information via simple, targeted forms that display just a few fields. Unlike apostrophe-moderator this module is focused on updating existing content, and minimizing all forms of friction that discourage updates.

## Configuration

Let's allow all fields of `event` to be potentially offered in an update form:

```
'apostrophe-update-forms': {
  types: {
    event: {}
  }
}
```

Now let's restrict the fields of `editableSchool` that can be offered this way to those that have a certain property:

```
'apostrophe-update-forms': {
  types: {
    editableSchool: {
      allowedField: function(field) {
        return field.leaderAccess;
      }
    }
  }
}
```

We can also enumerate the allowed fields:

```
'apostrophe-update-forms': {
  types: {
    'event': {
      allowedFields: [ 'startDate', 'endDate' ]
    }
  }
}
```

You may configure this module for any number of snippet types or page types by adding subproperties to `types`. The property name should match the instance name or page type. If it's powered by schemas and `site.pages.getManager(type)` can find it, you can update it with this module.

Now add the update forms menu to `outerLayout.html`:

```
  {{ aposUpdateFormsMenu(permissions) }}
```

Now you can create update forms via that menu. For each form you'll pick the type of object you want to update (if you configured more than one), and then add one or more fields to a list.

## Sending out update form links via mail merge

To make practical use of the update forms you need a way to display them to the right people, en masse. By far the most effective way is a mail merge: exporting a spreadsheet with the snippet's title, the recipient's name and email address, and a unique URL that allows that specific person to *update that specific snippet without logging in.* Combined with any good bulk email software you can accomplish your goal with that information.

Go to "Manage Update Forms," locate the row for the form you want, and click "Mail Merge." A CSV file will be generated and downloaded. Check it out in your spreadsheet software first, then use it to email your contributors. You'll want to insert the `url` column at the appropriate point in each message via your mail merge software.

## Configuring mail merge

**By default, Apostrophe will look for a `person` who has been specifically granted permissions for that one snippet.** If there is more than one only the first found is used. Since Apostrophe automatically grants editing permissions to the person who created a snippet, this works great for most projects.

However there are three other acceptable ways to specify the field for each type that connects it to the right person:

```
event: {
  mailMerge: {
    field: '_author'
  }
}
```

Apostrophe will use the `person` referred to by the existing `_author` `joinByOne` join in your schema for events.

```
event: {
  mailMerge: {
    field: 'contactEmail',
    personField: 'email'
  }
}
```

Apostrophe will look for a `person` whose `email` property matches the `contactEmail` property of the snippet.

```
event {
  mailMerge: {
    getPeople: function(req, objects, callback) { ... }
  }
}
```

Apostrophe will call your `getPeople` function, which is responsible for fetching the appropriate `person` snippets for the given objects and setting the `_person` property of each object to the appropriate person. If there is no suitable person, leave it undefined.

## Customizing the template

You can override `views/updateForm.html` to suit yourself. The forms are schema driven and there is only one template because admins can make any number of custom forms at any time, so they need to be fully automated in their rendering.

## Media

Currently the user cannot upload media unless they already happen to be logged in. It's on our TODO list to fix this so slideshow widgets can be part of the content being updated. It's not hard to port this logic which already exists in `apostrophe-moderator`.

## Security concerns

`apostrophe-update-forms` grants the user permission to edit the specific snippet for the duration of their session. Eventually it will also provide permission to upload media for the duration of their session. For security reasons, they are not logged into their Apostrophe account in the normal sense.

## Changelog

0.5.8: fixed a bug that prevented the "field and personField" approach to mailMerge configuration from working.

0.5.5: emit events before and after converting the form to make enhancement at the project level simple.

0.5.4: factored out `getMailMergeHeadings` and `getMailMergeRow` methods to allow project-level extension of the data to be included in mailmerges. Keep in mind that joins are performed as specified in your schema, so everything you need is likely to be there.
