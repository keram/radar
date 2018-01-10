const d3 = require('d3');
const Tabletop = require('tabletop');
const _ = {
    map: require('lodash/map'),
    uniqBy: require('lodash/uniqBy'),
    capitalize: require('lodash/capitalize'),
    each: require('lodash/each'),
    reduce: require('lodash/reduce')
};

const InputSanitizer = require('./inputSanitizer');
const Radar = require('../models/radar');
const Quadrant = require('../models/quadrant');
const Ring = require('../models/ring');
const Blip = require('../models/blip');
const GraphingRadar = require('../graphing/radar');
const MalformedDataError = require('../exceptions/malformedDataError');
const SheetNotFoundError = require('../exceptions/sheetNotFoundError');
const ContentValidator = require('./contentValidator');
const Sheet = require('./sheet');
const ExceptionMessages = require('./exceptionMessages');

const buildRings = function (names) {
    var ringMap = {};
    var maxRings = 4;

    _.each(names, function (name, i) {
        if (i == maxRings) {
            throw new MalformedDataError(ExceptionMessages.TOO_MANY_RINGS);
        }
        ringMap[name] = new Ring(name, i);
    });

    return ringMap;
}

const buildQuadrants = function (blips, ringMap) {
    var quadrants = {};

    _.each(blips, function (blip) {
        if (!quadrants[blip.quadrant]) {
            quadrants[blip.quadrant] = new Quadrant(_.capitalize(blip.quadrant));
        }
        quadrants[blip.quadrant].add(new Blip(blip.name, ringMap[blip.ring], blip.isNew.toLowerCase() === 'true', blip.topic, blip.description))
    });

    return quadrants;
}

const buildRadar = function (quadrants) {
    var radar = new Radar();

    _.each(quadrants, function (quadrant) {
        radar.addQuadrant(quadrant)
    });

    return radar;
}

const plotRadar = function (holder, radar) {
    var headerHeight = 180;
    var minSize = 620;
    var size = (window.innerHeight - headerHeight) < minSize ? minSize : window.innerHeight - headerHeight;
    holder.selectAll('.loading').remove();

    new GraphingRadar(size, radar).init(holder).plot();
}

const DocumentPrototype = {
    build: function () {},
    init: function (holder) {
        holder.classed('radar-holder', true);

        plotLoading(holder);

        this.holder = holder;

        return this;
    }
}

const documentUrl = function(str, location) {
    if (/^http(s)?\:\/\//.test(str)) {
        return str;
    } else {
        return location.origin.concat('/', str);
    }
}

const CSVDocument = function (options) {
    var self = {
        options: options,
        init: DocumentPrototype.init
    };

    self.build = function () {
        d3.csv(documentUrl(this.options.url, window.location), createBlips);
    }

    var ringNames = function(blips) {
        return self.options.rings || _.map(_.uniqBy(blips, 'ring'), 'ring');
    }

    var createBlips = function (data) {
        try {
            var columnNames = data['columns'];
            delete data['columns'];
            var contentValidator = new ContentValidator(columnNames);
            contentValidator.verifyContent();
            contentValidator.verifyHeaders();
            var blips = _.map(data, new InputSanitizer().sanitize);

            var rings = buildRings(ringNames(blips));
            var quadrants = buildQuadrants(blips, rings);
            var radar = buildRadar(quadrants);

            plotRadar(self.holder, radar);
        } catch (exception) {
            plotErrorMessage(self.holder, exception);
        }
    }

    return self;
};

const GoogleSheetInput = function (node) {
    var self = { };

    var parseConfig = function(config) {
        try {
            return JSON.parse(config);
        }
        catch (e) {
            return { url: config };
        }
    }

    self.build = function () {
        var options, holder;

        holder = d3.select(node);
        options = parseConfig(holder.attr('data-radar'));
        CSVDocument(options).init(holder).build();
    };

    return self;
};

function plotLoading(holder) {
    var loadingContent = holder.append('div')
        .attr('class', 'loading');

    plotBanner(loadingContent, '<p>Radar will be available in just a few seconds</p>');

    return holder;
}

function plotBanner(holder, text) {
    holder.append('div')
        .attr('class', 'input-sheet__banner')
        .html(text);

    return holder;
}

function plotErrorMessage(holder, exception) {
    holder.selectAll('.loading').remove();
    var message = 'Oops! It seems like there are some problems with loading your data. ';

    if (exception instanceof MalformedDataError) {
        message = message.concat(exception.message);
    } else if (exception instanceof SheetNotFoundError) {
        message = exception.message;
    } else {
        console.error(exception);
    }

    holder
        .append('div')
        .attr('class', 'error-container')
        .append('div')
        .attr('class', 'error-container__message')
        .append('p')
        .html(message);

    return holder;
}

module.exports = GoogleSheetInput;
