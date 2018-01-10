require('./stylesheets/base.scss');

const GoogleSheetInput = require('./util/factory');

document.querySelectorAll('[data-radar]')
        .forEach(function(elm) { GoogleSheetInput(elm).build(); });
        // .forEach(elm => GoogleSheetInput(elm).build());
