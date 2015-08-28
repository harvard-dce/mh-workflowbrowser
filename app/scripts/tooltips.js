

'use strict';

var colors,times;
var toolTipSpace=400;

function tipline(key,value,color){
  var line = '<div><strong>' + key + ': </strong> <span';
  if (color) {
    line += ' style="color: ' + color + '" ';
  }
  line += '>' + (value ? value : '') + '</span></div>';
  return line;
}

function commonTipText(d,rowLength){
  return '<div style="text-align:center;">Workflow</div>' +
        tipline('ID', d.id) +
        tipline('Series',  d.mediapackage.seriestitle) +
        tipline('Title', d.mediapackage.title) +
        tipline('State',d.state, colors.stateColor(d.state,'white')) +
        tipline('Capture Agent', d.eventLocation) +
        tipline('Producer',d.mediapackage.contributors.contributor) +
        tipline('Lecturer',d.mediapackage.creators.creator) +
        tipline('Workflow Duration',  times.toHHMMSS(d.duration/1000)) +
        tipline('Scheduled Duration', d.scheduledDuration ?
                times.toHHMMSS(d.scheduledDuration/1000) : 'NA') +
        tipline('Lecture Start to Available Duration',
                d.classStartToAvailableDuration ?
                times.toHHMMSS(d.classStartToAvailableDuration/1000) : 'NA', colors.untilAvailableColor(d.classStartToAvailableDuration))+
        tipline('Lecture Start to Ready for Trim Duration',
                d.untilReadyForTrimDuration ?
                times.toHHMMSS(d.untilReadyForTrimDuration/1000) : 'NA', colors.untilReadyForTrimColor(d.untilReadyForTrimDuration))+          
        tipline('Row', (d.row + 1) + ' of ' + rowLength);

}

function operationTipText(d){
  var jobCount=0;
  if (_.has(d,'job') && d.job.children){
    jobCount = d.job.children.length;
  }
  jobCount = jobCount ? jobCount : 0;
  return '<div style="text-align:center;">Operation</div>'+
          tipline('ID',d.id, colors.operationColor(d.id)) +
          tipline('Description', d.description) +
          tipline('State',d.state,colors.stateColor(d.state,'white'))+
          tipline('Started', d.dateStarted)+
          tipline('Completed', d.dateCompleted) +
          tipline('Duration', times.toHHMMSS(d.duration/1000)) +
          tipline('Performance Ratio', d.performanceRatio.toFixed(2)) +
           tipline('Number', d.count + ' of ' + d.workflowOperationsCount) +
           tipline('Child Jobs',''+jobCount); 
}


function jobTipText(d){
  var jobCount=0;
  jobCount = d.operation.job.children.length;
  var jobNumber=0;
  console.log('job:', d);
  return '<div style="text-align:center;color:yellow;">Job</div>'+
          tipline('ID',d.id) +
          tipline('Job Operation', d.description) +
          tipline('Type', d.type) +
          tipline('Status',d.status)+
          tipline('Started', d.dateStarted)+
          tipline('Completed', d.dateCompleted) +          
          tipline('Duration', times.toHHMMSS(d.duration/1000))  +
          tipline('Queue Time', times.toHHMMSS(d.queueTime/1000)) +
          tipline('Run Time', times.toHHMMSS(d.runTime/1000)) +
          tipline('Number', jobNumber +' of '+jobCount); 
}


function init(args){
  colors = args.colors;
  times  = args.times;
}

module.exports = {
  'init' : init,
  'jobTipText' : jobTipText,
  'commonTipText' : commonTipText,
  'operationTipText' :operationTipText,
  'tipline' : tipline,
  'toolTipSpace' : toolTipSpace
};
