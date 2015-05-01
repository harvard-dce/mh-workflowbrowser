
/*global d3:false */
/*global workflowBrowser */
/*jshint unused:false */

function _createWorkflowBrowser(conf,wfb) {
  'use strict';

  if ( ! wfb ) {
    wfb = {};
  }

  var width  = conf.width;
  var height = conf.height;

  wfb.operationColors= conf.operationColors || {'apply-acl':'#6baed6','tag':'#9ecae1','inspect':'#c6dbef','prepare-av':'#e6550d','compose':'#3182bd','waveform':'#fd8d3c','append':'#fdae6b','cleanup':'#fdd0a2','send-email':'#31a354','editor':'#74c476','image':'#a1d99b','segment-video':'#c7e9c0','segmentpreviews':'#756bb1','retract-engage':'#9e9ac8','publish-engage':'#bcbddc','test-local':'#dadaeb','zip':'#636363','execute-once':'#969696','archive':'#bdbdbd','error-resolution':'#d9d9d9','schedule':'#3182bd','capture':'#6baed6','ingest':'#9ecae1'};

  wfb.stateColors= conf.stateColors || { 'FAILED': 'red','STOPPED': 'orange','PAUSED':'#e6e600', 'RUNNING': '#756bb1', 'SUCCEEDED': 'grey', 'SKIPPED': 'grey'};

  var resized = true;

  wfb.dateStarted = null;
  wfb.dateCompleted = null;

  wfb.dataSources = conf.dataSources;
  wfb.maxMediaDuration =0;
  wfb.scaleByMediaDuration = true;

  wfb.visibleOperationIds = [];
  wfb.visibleWorkflowStates = [];
  wfb.visibleWorkflowIds = [];
  var textFilter = '';
  wfb.durationFilter = null;

  wfb.operationIds = [];
  wfb.workflowStates = [];

  var target = conf.target;
  var dateFormat = d3.time.format('%Y-%m-%dT%X');
  var workflows, operations, workflow24HourMarks;
  var rows =[[]];

  var maxOperationHeight = 0;
  var minOperationHeight = 4;
  var rulerHeight = 20;
  var operationHeight = 0;

  var offHours   = [];
  var midnights  = [];

  var twentyFourHoursInMs = 24*60*60*1000;

  // rationalize data workflow data structure if getting straight from MH.
  if (conf.workflows.hasOwnProperty('workflows') ) {
    conf.workflows = conf.workflows.workflows.workflow;
    $.each(conf.workflows,function(i,workflow){
      if (workflow.hasOwnProperty('operations')){
        workflow.operations = workflow.operations.operation;
      }
      if ( ! _.has(workflow.mediapackage,'contributors')){
        workflow.mediapackage.contributors={ 'contributor': 'No Producer' };
      }
      if ( ! _.has(workflow.mediapackage,'creators')){
        workflow.mediapackage.creators={ 'creator': 'No Creator' };
      }
    });
  }

  var updateTimeSpan = function updateTimeSpan(parentSpan,object) {
    if (object.hasOwnProperty('dateStarted')) {
      if (parentSpan.dateStarted === null ||
          object.dateStarted < parentSpan.dateStarted ) {
        parentSpan.dateStarted = object.dateStarted;
      }
    }
    if (object.hasOwnProperty('dateCompleted')){
      if (parentSpan.dateCompleted === null ||
          object.dateCompleted > parentSpan.dateCompleted ) {
        parentSpan.dateCompleted = object.dateCompleted;
      }
    }
  };

  var parseOperationDates = function parseOperationDates(object) {
    if (object.hasOwnProperty('started')){
      object.dateStarted = new Date(object.started);
    }
    if (object.hasOwnProperty('completed')) {
      object.dateCompleted = new Date(object.completed);
    }
    // use one timestamp for both ends if that's all we have.
    if (! (object.hasOwnProperty('dateStarted') &&
           object.hasOwnProperty('dateCompleted'))  ) {
      if (object.hasOwnProperty('dateCompleted') ){
        object.dateStarted = object.dateCompleted;
      }
      if (object.hasOwnProperty('dateStarted')) {
        object.dateCompleted = object.dateStarted;
      }
    }
    updateTimeSpan(wfb,object);
  };


  var getRow = function getRow(event){
    var eventFits = true;
    var eventRow  = -1;
    if ( ! (event.dateStarted && event.dateCompleted )) {
      // can't stack these guys.
      return -1;
    }
    $.each(rows,function(rowI,rowEvents){
      if (eventRow > -1){
        return false;
      }
      eventFits = true;
      $.each(rowEvents,function(eventI,e){
        if ( e.dateStarted <= event.dateCompleted &&
             e.dateCompleted >=  event.dateStarted ) {
          eventFits = false;
          return false;
        }
      });
      if ( eventFits ) {
        rowEvents.push(event);
        eventRow = rowI;
        return false;
      }
    });
    if (eventFits ) {
      return eventRow;
    } else {
      rows.push([]);
      rows[rows.length-1].push(event);
      return rows.length-1;
    }
  };

  var makeMidnight = function makeMidnight(day){
    day.setHours(0);
    day.setMinutes(0);
    day.setSeconds(0);
    return day;
  };

  var calculateOffHours = function calculateOffHours(){
    var oh ={};
    oh.dateCompleted = wfb.dateCompleted;
    var d = new Date(wfb.dateStarted.getTime());
    while (oh.dateCompleted <= wfb.dateCompleted) {
      oh = {};
      oh.dateStarted   = new Date(d.getTime());
      oh.dateStarted.setHours(17);   // 5 pm
      oh.dateCompleted = new Date(d.getTime());
      oh.dateCompleted.setHours(24); // 24 makes it next day
      oh.dateCompleted.setHours(9);  // 9 am
      d = oh.dateCompleted;
      offHours.push(oh);
      midnights.push(makeMidnight(new Date(oh.dateStarted.getTime())));
    }
    midnights.push(makeMidnight(new Date(oh.dateCompleted.getTime())));
  };

  var showOperation = function showOperation(operation){
    // should we show this operation?
    if (operation.hasOwnProperty('dateStarted') &&
        operation.hasOwnProperty('dateCompleted')){
      if (wfb.visibleOperationIds.length === 0 ||
          wfb.visibleOperationIds.indexOf(operation.id)>-1 ) {
        return true;
      }
    }
    return false;
  };

  var matchAny = function matchAny(pattern,strings){
    var i;
    for(i = 0; i < strings.length; i++) {
      if (pattern.test(strings[i])){
        return true;
      }
    }
    return false;
    };

    var showWorkflow = function showWorkflow(workflow){
        // should we show this workflow?
      if (workflow.hasOwnProperty('dateStarted') &&
          workflow.hasOwnProperty('dateCompleted')){
        // do any text filters knock it out?
        if ( textFilter ) {
          var p = new RegExp(textFilter,'i');
          if  (! matchAny(p, [
            workflow.mediapackage.title,
            workflow.mediapackage.series,
            workflow.mediapackage.seriestitle,
            workflow.mediapackage.contributors.contributor,
            workflow.mediapackage.creators.creator,
            workflow.id,
            workflow.eventLocation
          ])){
            return false;
          }
        }
        // do any state filters keep it in?
        if ( wfb.visibleWorkflowStates.length === 0 ||
             wfb.visibleWorkflowStates.indexOf(workflow.state)>-1) {
          if ( wfb.visibleWorkflowIds.length === 0 ||
               wfb.visibleWorkflowIds.indexOf(workflow.id)>-1) {
            return true;
          }
        }
        return false;
      }
    };

  var durationPredicate = function durationPredicate(workflow){
    if ( wfb.durationFilter ) {
      var f = wfb.durationFilter;
      if ( f.op === '*' ) {
        console.log('*');
        return true;
      } else {
        var expression = workflow[f.field]+ f.op + (f.val*60*60*1000);
        var wfd = workflow[f.field];
        var d   =  (f.val*60*60*1000);
        if (f.op === '<=') {
          return wfd <=  d;
        } else if (f.op === '>') {
          return wfd >  d;
        } else {
          console.log('Unsupported op: ' + f.op);
        }
      }
      return false;
    }
    return true;
  };

  var attachScheduledDuration = function attachScheduledDuration(w){
    if (w.hasOwnProperty('configurations') &&
        w.configurations.hasOwnProperty('configuration')) {
      $.each(w.configurations.configuration, function(i,c) {
        if ( c.key === 'schedule.start' ) {
          w.scheduleStart = new Date(c.$/1);
        } else if ( c.key === 'schedule.stop' ) {
          w.scheduleStop  = new Date(c.$/1);
        } else if ( c.key === 'event.location' ) {
          w.eventLocation = c.$;
        }
      });
    }
    if (w.hasOwnProperty('scheduleStart') &&
        w.hasOwnProperty('scheduleStop') ) {
      w.scheduleDuration = w.scheduleStop.getTime() - w.scheduleStart.getTime();
    }
  };

  var getDateAvailable = function getDateAvailable(workflow){
    var dateAvailable = null;
    $.each(workflow.operations,function(i,operation){
      if (operation.id === 'archive' ) {
        dateAvailable = operation.dateStarted;
        return;
      }
    });
    return dateAvailable;
  };

  var setWorkflowDateAvailables = function setWorkflowDateAvailables(workflows){
    $.each(workflows,function(i,workflow){
      workflow.dateAvailable = getDateAvailable(workflow);
      if ( workflow.dateAvailable && workflow.hasOwnProperty('scheduleStart')) {
        workflow.classStartToAvailableDuration =
          workflow.dateAvailable.getTime() - workflow.scheduleStart.getTime();
      }
    });
  };

  var setWorkflow24HourMarks = function setWorkflow24HourMarks(workflows) {
    $.each(workflows,function(i,workflow){
      if (workflow.hasOwnProperty('scheduleStart') ) {
        if ( workflow.dateAvailable ) {
          if (workflow.classStartToAvailableDuration > twentyFourHoursInMs) {
            var startPlus24 = new Date(
              workflow.dateStarted.getTime()+twentyFourHoursInMs);
            var mark = {'date': startPlus24, 'row': workflow.row };
            workflow24HourMarks.push(mark);
          }
        }
      }
    });
  };

  var stackWorkflows = function stackWorkflows(workflows){
    workflows = _.sortBy(workflows, 'dateStarted');
    $.each(workflows,function(i,workflow){
      var row = getRow(workflow);
      workflow.row = row;
      $.each(workflow.operations,function(operationI,operation){
        operation.row = row;
      });
    });
  };

  var processOperation = function processOperation(workflow,operation){
    parseOperationDates(operation);
    if ( operation.id === 'schedule' ) {
      attachScheduledDuration(workflow,operation);
    }
    if ( wfb.operationIds.indexOf(operation.id)===-1){
      wfb.operationIds.push(operation.id);
    }
    if (showOperation(operation)) {
      if (operation.dateStarted > operation.dateCompleted ) {
        operation.note = 'Operation "started" is past "completed" time. Huh?';
      }
      if ( workflow.dateCompleted === null ||
           workflow.dateCompleted < operation.dateCompleted) {
        workflow.dateCompleted = operation.dateCompleted;
      }
      if ( workflow.dateStarted === null ||
           workflow.dateStarted > operation.dateStarted ) {
        workflow.dateStarted = operation.dateStarted;
      }
    }
  };

  var processWorkflow = function processWorkflow(workflow){
    workflow.dateStarted =null;
    workflow.dateCompleted = null;
    if (wfb.workflowStates.indexOf(workflow.state)===-1){
      wfb.workflowStates.push(workflow.state);
        }
        $.each(workflow.operations,function(operationI,operation){
            processOperation(workflow,operation);
        });
    if ( workflow.dateCompleted === null || workflow.dateStarted === null ) {
      delete workflow.dateCompleted;
      delete workflow.dataStarted;
    }
    if (showWorkflow(workflow)) {
      workflow.duration =
        workflow.dateCompleted.getTime() - workflow.dateStarted.getTime();
      workflows.push(workflow);
      $.each(workflow.operations,function(operationI,operation){
        if (showOperation(operation)) {
          operation.count = operationI +1;
          operation.workflowOperationsCount = workflow.operations.length;
          operation.workflowId = workflow.id;
          operation.workflowState = workflow.state;
          operation.workflowMediaDuration =
            parseInt(workflow.mediapackage.duration);
          operation.duration =
            operation.dateCompleted.getTime() - operation.dateStarted.getTime();
          operation.performanceRatio =
            (operation.duration+0.0) / (operation.workflowMediaDuration+0.0);
          if (operation.workflowMediaDuration > wfb.maxMediaDuration) {
            wfb.maxMediaDuration = operation.workflowMediaDuration;
          }
          operations.push(operation);
        } else {
          // operation can legitimately not have dates:
          // they're defined in the workflow, but they haven't happened yet.
        }
      });
    }
  };

  var setWorkflows = function setWorkflows(wfs){
    // blow out any existing workflows and set to given.
    rows = [[]];
    workflows = [];
    operations = [];
    workflow24HourMarks = [];
    $.each(wfs,function(i,workflow){
      processWorkflow(workflow);
    });
    setWorkflowDateAvailables(workflows);
    workflows=_.filter(workflows,durationPredicate);
    stackWorkflows(workflows);
    if ( wfb.visibleOperationIds.length === 0 ||
         wfb.visibleOperationIds.length === wfb.operationIds.length) {
      setWorkflow24HourMarks(workflows);
    }
    // now weed out operations that haven't passed duration filter. messy.
    var visibleWorkflowIds = _.pluck(workflows,'id');
    //todo: faster contains
    operations = _.filter(operations,
                          function(o){ return _.contains(
                            visibleWorkflowIds,o.workflowId);});
    console.log('operations visible: ' + operations.length);
    console.log('workflows visible: ' + workflows.length);
  };

  var addUpdateWorkflows = function addUpdateWorkflows(wfs){
    var addUpdateIds = _.map(wfs,function(wf){return wf.id;});
    conf.workflows = _.reject(conf.workflows,
                              function(wf){
                                return _.contains(addUpdateIds,wf.id);
                              });
    conf.workflows = conf.workflows.concat(wfs);
    rawReload();
  };

  var removeWorkflows = function removeWorkflows(date,before){
    conf.workflows = _.reject(conf.workflows,
                              function(wf){
                                if ( before ) {
                                  return wf.dateCompleted < date;
                                } else {
                                  return wf.dateStarted > date;
                                }
                              });
    rawReload();
  };

  setWorkflows(conf.workflows);
  calculateOffHours();

  console.log('dateStarted: ' + wfb.dateStarted);
  console.log('dateCompleted: ' + wfb.dateCompleted);

  var container = d3.select(target);
  container.selectAll('*').remove();
  var nav = container.append('div').style('vertical-align','top');
  nav.classed('row',true);

  var skinnyCol = 'col-xs-6 col-sm-4 col-md-2';
  var fatCol    = 'col-xs-6 col-sm-3 col-md-2';

  var createSelectionLoader =
      function createSelectionLoader(label,id,options,selected){
        var d = nav.append('div').html(
          '<select class="form-control" id="' + id + '"></select>');
    d.classed(skinnyCol,true);
    $.each(options, function(key, value) {
      $('#'+id)
        .append($('<option>', { value : value.name })
                .text(value.name));
    });
    $('#'+id).val(selected);
    $('#'+id).change(function(){
      conf.selectedDataSourceName = $('#'+id).val();
      //total reload.
      conf.height=height;
      conf.width =width;
      workflowBrowser(conf,wfb);
    });
  };

  var createSelectionFilter =
      function createSelectionFilter(label,id,options,filterType){
        var d = nav.append(
          'div').html('<select multiple  id="' + id + '"></select>');
    d.classed(fatCol,true);
    $.each(options, function(key, value) {
      $('#'+id)
        .append($('<option>', { value : value })
                .text(value));
    });
    $('#'+id).multiselect({
      includeSelectAllOption: true,
      allSelectedText: 'All ' + label,
      nSelectedText: label,
      nonSelectedText: 'All ' + label,
      onChange: function(option, checked, select) {
        if ( $('#'+id).val() ) {
          wfb[filterType]=$('#'+id).val();
        } else {
          wfb[filterType]=[];
        }
        wfb.reload();
      }
    });
  };

  var createScaleSwitch = function createScaleSwitch(){
    var id='scaleSwitch';
    var d = nav.append(
      'div').html('<select class="form-control" id="' + id + '"></select>');
    d.classed(fatCol,true);
    $('#'+id).append($('<option>', { value : 'media_duration' }).text(
      'Scale by Media Duration'));
    $('#'+id).append($('<option>', { value : 'constant' }).text(
      'Constant Height'));
    $('#'+id).val('media_duration');
    $('#'+id).change(function(){
      wfb.scaleByMediaDuration =      $('#'+id).val() === 'media_duration';
      wfb.reload();
    });
  };

  var createTextFilter = function createTextFilter(){
    var id='textFilter';
    var d = nav.append('div').html(
      '<input class="form-control" type="text" placeholder="text filter (id,series,title,ca,producer,lecturer)" id="' + id + '">');
    d.classed(fatCol,true);
    $('#'+id).keyup(function(){
      textFilter=$('#'+id).val();
      wfb.reload();
    });
  };

  var createDurationFilter = function createDurationFilter(){
    var id='durationFilter';
    var d = nav.append('div').html(
      '<select class="form-control" id="' + id + '"></select>');
    d.classed(fatCol,true);
    var durationFilters = [
      {'name': 'All Durations','op':'*' },
      {'name': 'Start to Available <= 24 Hours','field': 'classStartToAvailableDuration','op':'<=', 'val':24},
      {'name': 'Start to Available > 24 Hours','field': 'classStartToAvailableDuration','op':'>', 'val':24},
      {'name': 'Start to Available > 48 Hours','field': 'classStartToAvailableDuration','op':'>', 'val':48},
      {'name': 'Entire Workflow <= 24 Hours','field': 'duration','op':'<=', 'val':24},
      {'name': 'Entire Workflow > 24 Hours','field': 'duration','op':'>', 'val':24},
      {'name': 'Entire Workflow > 48 Hours','field': 'duration','op':'>', 'val':48}
    ];
    $.each(durationFilters, function(i, filter) {
      $('#'+id)
        .append($('<option>', { value : i })
                .text(filter.name));
    });
    $('#'+id).val(0);
    $('#'+id).change(function(){
      wfb.durationFilter=durationFilters[$('#'+id).val()];
      wfb.reload();
    });
  };

  wfb.operationIds.sort();
  createSelectionLoader('Host','hostselector',wfb.dataSources,wfb.dataSource.name);
  createTextFilter();
  createSelectionFilter('Operations','opfilter',wfb.operationIds,'visibleOperationIds');
  createDurationFilter();
  createSelectionFilter('Workflow States','wfsfilter',wfb.workflowStates,'visibleWorkflowStates');
  createScaleSwitch();

  var svg = container
      .append('svg')
      .attr('width', width)
      .attr('height', height);

  var scale = d3.time.scale()
      .domain([wfb.dateStarted, wfb.dateCompleted]).range([10,width]);

  var xaxis = d3.svg.axis().scale(scale)
      .orient('bottom');

  var updateXAxis = function(){
    // I don't quite get what this does,
    // but seems to be necessary after zoom and resize.
    svg.select('g').call(xaxis).selectAll('text').style('font-size', '8x');
  };

  var zoom = d3.behavior.zoom()
      .on('zoom', function(){
        wfb.refresh();
      }).x(scale);

  // pane to catch zoom events.
  var zoomPane = svg.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', width)
      .attr('height', height)
      .attr('opacity', 0)
      .call(zoom);

  // x-axis
  svg.append('g')
    .attr('class', 'xaxis')
    .call(xaxis)
  ;

  wfb.size = function(w,h) {
    if (!arguments.length) {
      return [width,height];
    }
    resized= true;
    width  = w;
    height = h;
    container.attr('width', width).attr('height', height);
    svg.attr('width', width).attr('height', height);
    scale.range([10, width]);
    xaxis.scale(scale);
    zoomPane.attr('width', width);
    zoomPane.attr('height', height);
    wfb.refresh();
    resized= false;
    return wfb;
  };

  var stateColor = function stateColor(state,defaultColor) {
    return _.result(wfb.stateColors,state,defaultColor);
  };

  var operationColor = function operationColor(operationId){
    return _.result(wfb.operationColors,operationId,'black');
  };

  var toHHMMSS = function toHHMMSS(secNum) {
    var hours   = Math.floor(secNum / 3600);
    var minutes = Math.floor((secNum - (hours * 3600)) / 60);
    var seconds = Math.floor(secNum - (hours * 3600) - (minutes * 60));
    if (hours   < 10) {hours   = '0'+hours;}
    if (minutes < 10) {minutes = '0'+minutes;}
    if (seconds < 10) {seconds = '0'+seconds;}
    var time    = hours+':'+minutes+':'+seconds;
    return time;
  };

  // todo: rationalize tooltips.

  var toolTipSpace=175;

  var opTip = d3.tip()
      .attr('class', 'd3-tip')
      .offset(function(d){
        return d3.mouse(this)[1]<toolTipSpace ? [10,-10] : [-10, 0]; } )
      .html(function(d) {
        return tipline('Operation ID',d.id, operationColor(d.id)) +
          tipline('Workflow ID', d.workflowId) +
          tipline('Number', d.count + ' of ' + d.workflowOperationsCount) +
          tipline('Description', d.description) +
          tipline('State',d.state,stateColor(d.state,'white'))+
          tipline('Started', d.dateStarted)+
          tipline('Completed', d.dateCompleted) +
          tipline('Duration', toHHMMSS(d.duration/1000)) +
          tipline('Media Duration (trimmed)',
                  toHHMMSS(d.workflowMediaDuration/1000)) +
          tipline('Performance Ratio', d.performanceRatio.toFixed(2))
        ;

      });
  svg.call(opTip);

  var tipline = function tipline(key,value,color){
    var line = '<div><strong>' + key + ': </strong> <span';
    if (color) {
      line += ' style="color: ' + color + '" ';
    }
    line += '>' + (value ? value : '') + '</span></div>';
    return line;
  };

  var extractMediaDurations = function extractMediaDurations(d) {
    var html = '';
    if ( d.mediapackage.hasOwnProperty('duration') ) {
      html += tipline('Media Duration', toHHMMSS(d.mediapackage.duration/1000));
    }
    if (d.mediapackage.hasOwnProperty('media')){
      if (d.mediapackage.media.hasOwnProperty('track')) {
        $.each(d.mediapackage.media.track, function(i,track) {
          if (track.hasOwnProperty('duration')) {
            html += tipline(track.type,  toHHMMSS(track.duration/1000));
          }
        });
      }
    } else {
      console.log('No media in mediapackage!');
      console.log(d.mediapackage);
      console.log(d);
    }
    if ( html )  {
      return html;
    } else {
      return tipline('Media Duration', 'NA');
    }
  };

  var wf24Tip = d3.tip()
      .attr('class', 'd3-tip')
      .offset([-10,0])
      .html('This lecture failed to meet 24 hour turnaround!')
  ;
  svg.call(wf24Tip);

  var wfTip = d3.tip()
      .attr('class', 'd3-tip')
      .offset(function(d){
        return d3.mouse(this)[1]<toolTipSpace ? [10,-10] : [-10, 0];})
      .html(function(d) {
        return tipline('Workflow ID', d.id) +
          tipline('Series',  d.mediapackage.seriestitle) +
          tipline('Title', d.mediapackage.title) +
          tipline('State',d.state, stateColor(d.state,'white')) +
          tipline('Capture Agent', d.eventLocation) +
          tipline('Producer',d.mediapackage.contributors.contributor) +
          tipline('Lecturer',d.mediapackage.creators.creator) +
          tipline('Workflow Duration',  toHHMMSS(d.duration/1000)) +
          tipline('Scheduled Duration', d.scheduleDuration ?
                  toHHMMSS(d.scheduleDuration/1000) : 'NA') +
          tipline('Class Start to Available Duration',
                  d.classStartToAvailableDuration ?
                  toHHMMSS(d.classStartToAvailableDuration/1000) : 'NA') +
          extractMediaDurations(d)
        ;
      });
  svg.call(wfTip);

  opTip.direction(function(d) {
    opTip.attr('class', 'd3-tip');
    if (d3.mouse(this)[1] < toolTipSpace) {
      return 's';
    }
    return 'n';
  });


  wfTip.direction(function(d) {
    wfTip.attr('class', 'd3-tip');
    if (d3.mouse(this)[1] < toolTipSpace) {
      return 's';
    }
    return 'n';
  });

  var setOperationHeight = function setOperationHeight(){
    maxOperationHeight = 28;
    operationHeight = (height - rulerHeight) / rows.length;
    if (operationHeight < minOperationHeight ) {
      operationHeight = minOperationHeight;
    } else if (operationHeight > maxOperationHeight ) {
      operationHeight = maxOperationHeight;
    }
  };

  var workflowUrl = function workflowUrl(workflowId) {
    return wfb.dataSource.host + '/admin/index.html#/inspect?id=' + workflowId;
  };

  var sizeEvents = function sizeEvents(events){
    // [re]size operations and workflow wfbs
    return events
      .attr('x', function(o){return scale(o.dateStarted);})
      .attr('width', function(o){return d3.max([2, scale(
        o.dateCompleted) - scale(o.dateStarted)]);});
  };

  var renderEvents = function renderEvents(){
    setOperationHeight();
    renderOffHours(offHours);
    renderMidnights(midnights);
    renderWorkflows(workflows);
    renderOperations(operations);
    render24HourMarks(workflow24HourMarks);
  };

  var scaledOperationHeight = function scaledOperationHeight(o){
    if ( wfb.scaleByMediaDuration ) {
      return Math.max(4,operationHeight *
                      (parseInt(o.workflowMediaDuration)/
                       parseInt(wfb.maxMediaDuration)));
    } else {
      return operationHeight;
    }
  };

  var workflowY = function workflowY(wf){
    return rulerHeight + (operationHeight/2.0) +
      wf.row * (operationHeight+2) -1;
  };

  var scaledOperationY   = function scaledOperationY(o) {
    var rowY = rulerHeight+ (o.row * (operationHeight+2));
    if (wfb.scaleByMediaDuration ) {
      return workflowY(o)-(scaledOperationHeight(o)/2)+1;
    } else {
      return rowY;
    }
  };

  var renderOperations = function renderOperations(ops){
    wfb.operations=ops;
    // bind data
    var events = svg.selectAll('rect.operation').data(ops, function(d){return d.job; });
    // enter
    events.enter()
      .append('rect')
      .attr('class', 'operation')
      .style('stroke', function(o) {
        return stateColor(o.state,operationColor(o.id));})
      .on('mouseover', opTip.show)
      .on('mouseout',  opTip.hide)
      .on('click', function(o) { if ( o.workflowState !== 'STOPPED') {
        window.open(workflowUrl(o.workflowId), '_blank'); } })
      .style('fill', function(o) { return operationColor(o.id); })
    ;
    // update y
    if ( resized ) {
      events
        .attr('y', function(o){ return scaledOperationY(o);})
        .attr('height', function(o){return scaledOperationHeight(o);})
      ;
    }
    // update x
    events
      .call(sizeEvents)
    ;
    // exit
    events.exit().remove();
  };

  var render24HourMarks = function render24HourMarks(workflow24HourMarks){
    // enter
    var events = svg.selectAll('circle.workflow24').data(workflow24HourMarks);
    events.enter()
      .append('circle')
      .attr('class', 'workflow24')
      .style('fill',  'red')
      .style('stroke', 'red')
      .style('opacity',0.6)
      .on('mouseover', wf24Tip.show)
      .on('mouseout', wf24Tip.hide)
    ;
    if (resized){
      events
        .attr('cy', function(d){ return workflowY(d)+1; })
        .attr('r', operationHeight/4)
      ;
    }
    // update x
    events
      .attr('cx', function(d) {return scale(d.date); })
    ;
    // exit
    events.exit().remove();
  };

  var renderWorkflows = function renderWorkflows(workflows){
    // enter
    var events = svg.selectAll('rect.workflow').data(workflows);
    events.enter()
      .append('rect')
      .attr('class', 'workflow')
      .attr('height', 2)
      .on('mouseover', wfTip.show)
      .on('mouseout', wfTip.hide)
      .style('fill',  function(wf) {return stateColor(wf.state,'black');})
      .style('stroke', 'white')
      .style('opacity',0.6)
    ;
    // update y
    if (resized){
      events
        .attr('y', function(wf){ return workflowY(wf); })
      ;
    }
    // update x
    events
      .call(sizeEvents)
    ;
    // remove
    events.exit().remove();
  };

  var renderMidnights = function renderMidnights(midnights){
    // enter
    var events = svg.selectAll('line.daybounds').data(midnights);
    events.enter()
      .append('line')
      .attr('class', 'daybounds')
      .style('stroke', 'gray')
      .style('stroke-dasharray', '1,0,1')
      .style('opacity',0.6)
      .style('pointer-events', 'none')
    ;
    // update y
    if (resized){
      events
        .attr('y1', rulerHeight )
        .attr('y2', height )
      ;
    }
    // update x
    events
      .attr('x1', function(d) {return scale(d); })
      .attr('x2', function(d) {return scale(d); })
    ;
    // remove
    events.exit().remove();
  };

  var renderOffHours = function renderOffHours(offHours){
    // enter
    var events = svg.selectAll('rect.offHours').data(offHours);
    events.enter()
      .append('rect')
      .attr('class', 'offHours')

      .style('fill',  '#f6f6f6')
      .style('stroke', '#f6f6f6')
      .style('opacity',0.6)
      .style('pointer-events', 'none')
    ;
    // update y
    if (resized){
      events
        .attr('y', rulerHeight )
        .attr('height', height-rulerHeight)
      ;
    }
    // update x
    events
      .call(sizeEvents)
    ;
    // remove
    events.exit().remove();
  };

  renderEvents();
  resized=false;

  wfb.refresh = function(){
    updateXAxis();
    renderEvents();
  };

  var rawReload = function rawReload(){
    console.log('reloading workflow browser data...');
    setWorkflows(conf.workflows);
    wfb.size(width,height);
  };

    // potentially slow, so we throttle it.
    wfb.reload = _.throttle(rawReload,1000);

  wfb.addUpdateWorkflows = addUpdateWorkflows;
  wfb.removeWorkflows = removeWorkflows;
  wfb.workflows = workflows;
  return wfb;
}


function workflowBrowser(conf,wfb){
  'use strict';
  if ( ! wfb ) {
    wfb = {};
  }
  wfb.dataSource = _.find(conf.dataSources,function(ds){
    return ds.name === conf.selectedDataSourceName; });

  var dataUrl =  wfb.dataSource.dataUrl;
  d3.select(conf.target).html(
    '<p class="wfb_loading">Loading workflow data...</p>');
  d3.json(dataUrl, function(error,data) {
    if (error) {
      var message ='Error getting data from : ' + dataUrl;
      console.log(message);
      data = [];
    } else {
      console.log('got data from: ' + dataUrl);
    }
    conf.workflows = data;
    _createWorkflowBrowser(conf,wfb);
  });
  return wfb;
}
