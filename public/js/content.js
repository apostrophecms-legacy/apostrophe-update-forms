apos.updateForms = {
  enableForm: function(schema, object) {
    $(function() {
      var $form = $('[data-apos-update-form]');
      $('body').on('click', '[data-apos-update-forms-save]', function() {
        return aposSchemas.convertFields($form, schema, object, function(err) {
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
