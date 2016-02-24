// JavaScript which enables editing of this module's content belongs here.

function AposUpdateForms(options) {
  var self = this;
  AposSnippets.call(self, options);

  self.addingToManager = function($el, $snippet, snippet) {
    var $editUpdateForm = $snippet.find('[data-edit]');
    $editUpdateForm.attr('data-slug', snippet.slug);
    var $mailMerge = $snippet.find('[data-mail-merge]');
    $mailMerge.attr('href', self._action + '/mail-merge?id=' + snippet._id + '&cache_buster=' + apos.generateId());
  };
}

