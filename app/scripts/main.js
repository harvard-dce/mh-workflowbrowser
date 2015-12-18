
/*global d3:false */
/*global workflowBrowser */
/*jshint unused:false */

'use strict';

function _createWorkflowBrowser(conf,wfb) {
  
  wfb.operationConf = conf.operationConf || {'apply-acl':{'color':'#6baed6'},'tag':{'color':'#9ecae1'},'inspect':{'color':'#c6dbef'},'prepare-av':{'color':'#e6550d'},'compose':{'color':'#3182bd'},'waveform':{'color':'#fd8d3c'},'append':{'color':'#fdae6b'},'cleanup':{'color':'#fdd0a2'},'send-email':{'color':'#31a354','boost':1 },'editor':{'color':'#74c476'},'image':{'color':'#a1d99b'},'segment-video':{'color':'#c7e9c0'},'segmentpreviews':{'color':'#756bb1'},'retract-engage':{'color':'#9e9ac8'},'publish-engage':{'color':'#bcbddc'},'test-local':{'color':'#dadaeb'},'zip':{'color':'#636363'},'execute-once':{'color':'#969696'},'archive':{'color':'#bdbdbd'},'error-resolution':{'color':'#d9d9d9'},'schedule':{'color':'#3182bd', 'visible':false},'capture':{'color':'#6baed6'},'ingest':{'color':'#9ecae1'}, 'process-smiltrack': {'color': '#afafaf'}};
      
  var timeManager    = require('./times').createTimeManager();
  var colorist   = require('./colors').createColorist({'timeManager':timeManager,'operationConf':wfb.operationConf,'confStateColors':conf.stateColors});  
  var tooltipper = require('./tooltips').createTooltipper({'timeManager':timeManager,'colorist':colorist}); 
  var stacker  = require('./stacker');
  
  var dateStarted, dateCompleted;
  var offHours = [];
  var midnights = [];

  if ( ! wfb ) {
    wfb = {};
  }

  var width  = conf.width;
  var height = conf.height;
  var workflowTip,operationTip,jobTip,lateAvailableTip, lateTrimTip;

  wfb.visibleOperationIds = []; 
 
  $.each(wfb.operationConf,function(id,props){
    if ( ! props.hasOwnProperty('visible') ) {
      props.visible=true;
    }
    if (wfb.operationConf[id].visible){
      wfb.visibleOperationIds.push(id);
    }
  });

  var resized = true;

  _.defaults(wfb, { 'dateStarted':  null}); 
  _.defaults(wfb, { 'dateCompleted': null});  

  wfb.dataSources = conf.dataSources;
  wfb.maxMediaDuration =0;
  wfb.scaleByMediaDuration = true;


  wfb.visibleWorkflowStates = [];
  wfb.visibleWorkflowIds = [];
  var textFilter = '';
  wfb.durationFilter = null;

  wfb.operationIds = [];
  wfb.workflowStates = [];

  var target = conf.target;
  var container = d3.select(target);
  var dateFormat = d3.time.format('%Y-%m-%dT%X');
  var workflows, operations, jobs, workflow24HourMarks, lateTrimMarks;
  jobs = [];
  var workflowStacker, jobStacker;

  var maxOperationHeight = 0;
  var minOperationHeight = 3;
  var rulerHeight = 20;
  var operationHeight = 0;

  var workflowById = {};
  
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

  var stackWorkflows = function stackWorkflows(workflows){
    workflows = _.sortBy(workflows, 'dateStarted');
    $.each(workflows,function(i,workflow){
      var row = workflowStacker.stack(workflow);
      workflow.row = row;
      $.each(workflow.operations,function(operationI,operation){
        operation.row = row;
      });
    });
  };

  var processOperation = function processOperation(workflow,operation){
    timeManager.setOperationDates(wfb,operation);
    if ( operation.id === 'schedule' ) {
      timeManager.attachScheduledDuration(workflow,operation);
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
      delete workflow.dateStarted;
    }
    if (showWorkflow(workflow)) {
      workflow.duration =
        workflow.dateCompleted.getTime() - workflow.dateStarted.getTime();
      workflowById[workflow.id]=workflow;
      workflows.push(workflow);
      $.each(workflow.operations,function(operationI,operation){
        if (showOperation(operation)) {
          operation.count = operationI +1;
          operation.workflowOperationsCount = workflow.operations.length;
          operation.workflowId = workflow.id;
          operation.workflowState = workflow.state;
          operation.workflowMediaDuration =
            parseInt(workflow.mediapackage.duration) || workflow.scheduledDuration || 1; // is this kosher?
          try {
            operation.duration =  operation.dateCompleted.getTime() - operation.dateStarted.getTime();
          } catch (e){
            console.log(operation.dateCompleted);
            console.log(operation.dateStarted);
            console.log(operation);
          }
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
    workflowStacker = stacker.create();
    workflows = [];
    operations = [];
    jobs =[];
    workflow24HourMarks = [];
    lateTrimMarks =[];
    $.each(wfs,function(i,workflow){
      processWorkflow(workflow);
    });
    timeManager.setWorkflowDateAvailables(workflows);
    workflows=_.filter(workflows,durationPredicate);
    stackWorkflows(workflows);
    if ( true ) {
      timeManager.setWorkflow24HourMarks(workflows,workflow24HourMarks);
      timeManager.setLateTrimMarks(workflows,lateTrimMarks);
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
  timeManager.calculateOffHoursAndMidnights(wfb,offHours,midnights);

  console.log('dateStarted: ' + dateStarted);
  console.log('dateCompleted: ' + dateCompleted);


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
      pushUrlState(['dsn']);
      //total reload.
      conf.height=height;
      conf.width =width;
      wfb.dateStarted=null;
      wfb.dateCompleted=null;
      workflowBrowser(conf,wfb);
    });
  };

  var pushUrlState = _.throttle(function pushUrlState(statesToPush){
    var queryString = '?dsn='+conf.selectedDataSourceName;
    if ( !statesToPush || 'a' in statesToPush  ) {
      var a = scale.invert(1).getTime();
      queryString += '&a='+a;
    }
    if ( !statesToPush || 'z' in statesToPush ) {
      var z = scale.invert(width-1).getTime();
      queryString += '&z='+z;
    }
    history.pushState(null,document.title, queryString);
  },3000);

  var createSelectionFilter =
      function createSelectionFilter(label,id,options,filterType){
        var d = nav.append(
          'div').html('<select multiple  id="' + id + '"></select>');
    d.classed(fatCol,true);
    $.each(options, function(key, value) {
      var props = { value : value };
      // hack
      if (filterType === 'visibleOperationIds' ) {
        if (wfb.operationConf.hasOwnProperty(value) && wfb.operationConf[value].visible){
          props.selected = 'selected';
        }
      }
      $('#'+id)
        .append($('<option>', props)
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
      {'name': 'Start until Available <= 24 Hours','field': 'classStartToAvailableDuration','op':'<=', 'val':24},
      {'name': 'Start until Available > 24 Hours','field': 'classStartToAvailableDuration','op':'>', 'val':24},
      {'name': 'Start until Available > 48 Hours','field': 'classStartToAvailableDuration','op':'>', 'val':48},
      {'name': 'Start until Ready for Trim <= ' + timeManager.lateTrimHours +' Hours','field': 'untilReadyForTrimDuration','op':'<=', 'val':timeManager.lateTrimHours},
      {'name': 'Start until Ready for Trim > '+ timeManager.lateTrimHours + ' Hours','field': 'untilReadyForTrimDuration','op':'>', 'val':timeManager.lateTrimHours},
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


function initWorkflowTip(){
      workflowTip = d3.tip()
      .attr('class', 'd3-tip')
      .offset(function(){
        return d3.mouse(this)[1]<tooltipper.toolTipSpace ? [10,-10] : [-10, 0];})
      .html(function(d) {
        return tooltipper.commonTipText(d,workflowStacker.rowCount());}
     );
  svg.call(workflowTip);
  workflowTip.direction(function() {
    workflowTip.attr('class', 'd3-tip');
    if (d3.mouse(this)[1] < tooltipper.toolTipSpace) {
      return 's';
    }
    return 'n';
    });
}

function setJobsToRender(operation){
  if ( _.has(operation,'job') && _.has(operation.job,'children')){   
    // mongo is doing funny things to my arrays...
    jobs=[];
    jobStacker = stacker.create();
    $.each(operation.job.children,function(i,job){
      job.count=i+1;
      // confusing: operations cointain jobs,
      // but there is also a distinct property of job called 'operation'
      if (! _.has(job,'jobOperation')){
        job.jobOperation = job.operation;
      }
      job.operation=operation;
      timeManager.setJobDates(job);
      jobStacker.stack(job);
      jobs.push(job);
    });
    renderJobs(jobs);
  } else {
    //console.log('no jobs to render for this bad boy: ', operation);
  }
}

function initOperationTip(){
  operationTip = d3.tip()
      .attr('class', 'd3-tip')
      .offset(function(){
        return d3.mouse(this)[1]<tooltipper.toolTipSpace ? [10,-10] : [-10, 0]; } )
      .html(function(d) {
        setJobsToRender(d);    
        return tooltipper.commonTipText(workflowById[d.workflowId],workflowStacker.rowCount()) + '<hr />' + tooltipper.operationTipText(d)
        ;
      });  
  svg.call(operationTip);
  operationTip.direction(function() {
    operationTip.attr('class', 'd3-tip');
    if (d3.mouse(this)[1] < tooltipper.toolTipSpace) {
      return 's';
    }
    return 'n';
  });
}

function initJobTip(){
  jobTip = d3.tip()
      .attr('class', 'd3-tip')
      .offset([-10,0])
      .html(function(d){return tooltipper.jobTipText(d);})
  ;
  svg.call(jobTip);
}

function initLateAvailableTip () {
  lateAvailableTip = d3.tip()
      .attr('class', 'd3-tip')
      .offset([-10,0])
      .html('This lecture failed to meet 24 hour turnaround!')
  ;
  svg.call(lateAvailableTip);
}

function initLateTrimTip(){
  lateTrimTip = d3.tip()
      .attr('class', 'd3-tip')
      .offset([-10,0])
      .html('This lecture was not ready for trim within ' + timeManager.lateTrimHours + ' hours!')
  ;
  svg.call(lateTrimTip);
}

function initTooltips(){
  initWorkflowTip();
  initOperationTip();
  initJobTip();
  initLateTrimTip();
  initLateAvailableTip();  
}

initTooltips();

  if (_.has(wfb.urlState,'a')){
      wfb.dateStarted = new Date(parseInt(wfb.urlState.a));
      console.log('urlState a:' + wfb.dateStarted);
  }
  
  if (_.has(wfb.urlState,'z')){
    wfb.dateCompleted = new Date(parseInt(wfb.urlState.z));
    console.log('urlState z:' + wfb.dateCompleted);
  }

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
        pushUrlState();
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

  wfb.refresh = function refresh(){
    updateXAxis();
    renderEvents();
  };

  var setOperationHeight = function setOperationHeight(){
    maxOperationHeight = 28;
    var navHeight = nav.node().getBoundingClientRect().height;
    operationHeight = (height - rulerHeight - navHeight) / workflowStacker.rowCount() -2;
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
    if (wfb.dateStarted && wfb.dateCompleted){
      setOperationHeight();
      renderOffHours(offHours);
      renderMidnights(midnights);
      renderWorkflows(workflows);
      renderOperations(operations);
      renderJobs(jobs);
      render24HourMarks(workflow24HourMarks);
      renderLateTrimMarks(lateTrimMarks);
    } else {
      console.log('Not rendering events because no scaling dates.');
    }
  };

  var scaledOperationHeight = function scaledOperationHeight(o){
    var boost = wfb.operationConf.hasOwnProperty(o.id) ? wfb.operationConf[o.id].boost : 0;
    boost = boost ? boost : 0;
    boost*=4;
    if ( wfb.scaleByMediaDuration ) {
      var h = Math.max(4,operationHeight *
                      (parseInt(o.workflowMediaDuration)/
                       parseInt(wfb.maxMediaDuration)))+boost;
      if (!h){
        console.log('Aha!',operationHeight,o.workflowMediaDuration,wfb.maxMediaDuration);

      }
      return h;
    } else {
      return operationHeight+boost;
    }
  };

  var workflowY = function workflowY(wf){
    return rulerHeight + (operationHeight/2.0) +
      wf.row * (operationHeight+2) -1;
  };

  var scaledOperationY   = function scaledOperationY(o) {
    var rowY = rulerHeight+ (o.row * (operationHeight+2));
    var boost = wfb.operationConf.hasOwnProperty(o.id) ? wfb.operationConf[o.id].boost : 0;
     boost = boost ? boost : 0;
    if (wfb.scaleByMediaDuration ) {
      return workflowY(o)-(scaledOperationHeight(o)/2)+1+-boost;
    } else {
      return rowY-boost;
    }
  };

  var renderOperations = function renderOperations(ops){
    wfb.operations=ops;
    // bind data
    var events = svg.selectAll('rect.operation').data(ops);
    // enter
    events.enter()
      .append('rect')
      .attr('class', 'operation')
      .style('stroke', function(o) {
        return colorist.stateColor(o.state,colorist.operationColor(o.id));})
      .on('mouseover', operationTip.show)
      .on('mouseout',  operationTip.hide)
      .on('click', function(o) { if ( o.workflowState !== 'STOPPED') {
        window.open(workflowUrl(o.workflowId), '_blank'); } })
      .style('fill', function(o) { return colorist.operationColor(o.id); })
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

  var renderJobs = function renderJobs(jobs){
    var events = svg.selectAll('rect.job').data(jobs);
    //console.log('reindering jobs: ' + jobs.length); // enter
    events.enter()
      .append('rect')
      .attr('class', 'job')
       .attr('rx', 1)
      .attr('ry', 1)
      .style('stroke',  'yellow')
      .style('opacity',0.6)
      .on('mouseover', jobTip.show)
      .on('mouseout',  jobTip.hide)      
      .style('fill', 'yellow' )
    ;
    // update y
    if ( true ) {
      events
        .attr('y', function(d){ return workflowY(d.operation)-1;})
        .attr('height', 3);
        //.attr('height', function(d){return scaledOperationHeight(d.operation);})
      
    }
    // update x
    events
      .call(sizeEvents)
    ;
    // exit
    events.exit().remove();
  };

  var render24HourMarks = function render24HourMarks(marks){
    renderLateMarks(marks,'workflow24','red',lateAvailableTip);
  };

  var renderLateTrimMarks = function renderLateTrimMarks(marks){
    renderLateMarks(marks,'lateTrim','orange',lateTrimTip);
  };

  var renderLateMarks = function renderLateMarks(marks,classname,color,tip){
    // enter
    var events = svg.selectAll('circle.'+classname).data(marks);
    events.enter()
      .append('circle')
      .attr('class', classname)
      .style('fill',  color)
      .style('stroke', color)
      .style('opacity',0.6)
      .on('mouseover', tip.show)
      .on('mouseout', tip.hide)
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
    var events = svg.selectAll('rect.workflow').data(workflows,function(d){return d.id;});
    events.enter()
      .append('rect')
      .attr('class', 'workflow')
      .attr('height', 2)
      .on('mouseover', workflowTip.show)
      .on('mouseout', workflowTip.hide)
      .style('fill',  function(wf) {return colorist.stateColor(wf.state,'black');})
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




  var rawReload = function rawReload(){    
    // make sure blast circles and workflows are removed so "z-index" is
    // correct when they are re-added.
    container.selectAll('circle').remove();
    container.selectAll('rect.operation').remove();
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
  if ( ! wfb ) {
    wfb = {};
  }

  var getUrlState = function getUrlState() {
    var params = [], hash;
    var querySeparatorLocation = window.location.href.indexOf('?') + 1;
    var hashes = window.location.href.slice(querySeparatorLocation).split('&');
    for(var i = 0; i < hashes.length; i++) {
      hash = hashes[i].split('=');
      params.push(hash);
      params[hash[0]] = hash[1];
    }
    return params;
  };

  var urlState = getUrlState();
  wfb.urlState = urlState;

  if ( _.has(urlState,'dsn')){
    console.log('Setting selected dataSourceName to ' + urlState.dsn);
    conf.selectedDataSourceName = urlState.dsn;
  }

  wfb.dataSource = _.find(conf.dataSources,function(ds){
    return ds.name === conf.selectedDataSourceName; });

  var dataUrl =  wfb.dataSource.dataUrl;
  var wfbServerParams = '';
  if ( wfb.dataSource.type === 'wfb-server'){
    var a = wfb.urlState.a;
    var z = wfb.urlState.z;
    if ( a && z ){
      wfbServerParams='?a=' + a + '&z=' +z;
    }
  }
  d3.select(conf.target).html(
    '<p class="wfb_loading">Loading workflow data...</p>');
  d3.json(dataUrl+wfbServerParams, function(error,data) {
    if (error) {
      var message ='Error getting data from : ' + dataUrl;
      console.log(message);
      data = [];
    } else {
      console.log('got data from: ' + dataUrl);
    }
    if (_.has(data,'workflows')){
          console.log('workflow data looks good!');
          conf.workflows = data;
        } else {
          console.log('attempting to fix workflows...'+ data.length);
          conf.workflows= {'workflows': { 'workflow': data }} ;
          //console.log('AHA!');
          //console.log(conf.workflows.workflows.workflow.length);
      }
    _createWorkflowBrowser(conf,wfb);
  });
  return wfb;
}


module.exports = workflowBrowser;
global.workflowBrowser = workflowBrowser;
