apos.updateForms = {
  enableForm: function(schema, object) {
    $(function() {
      var $form = $('[data-apos-update-form]');

      // Focus first, unless it's a selectize dropdown. Borrowed from modals
      if ($form.find(".apos-fieldset:first.apos-fieldset-selectize, form:not(.apos-filter) .apos-fieldset:first.apos-fieldset-array .apos-fieldset:first.apos-fieldset-selectize").length === 0 ) {
        $form.find(".apos-fieldset:not([data-extra-fields-link]):first :input:visible:enabled:first").focus();
      }

      $('body').on('click', '[data-apos-update-forms-save]', function() {
        aposSchemas.convertFields($form, schema, object, function(err) {
          if (err) {
            // Errors have been displayed, let them keep trying
            return;
          }
          apos.globalBusy(true);
          return $.jsonCall(window.location.href, object, function(result) {
            apos.globalBusy(false);
            if (result.status === 'ok') {
              $form.hide();
              $('[data-apos-update-forms-body]').hide();
              $('[data-apos-update-forms-thanks]').show();
            } else {
              alert('Hmm, something is not quite right. Please wait a moment and try again.');
            }
          });
        });
        return false;
      });
      return aposSchemas.populateFields($form, schema, object, function(err) {
        // Nothing more to do
      });
    });
  }
};
