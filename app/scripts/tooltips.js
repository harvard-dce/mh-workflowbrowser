

'use strict';

function createTooltipper(conf){

  var toolTipSpace=400;
  var colorist = conf.colorist;
  var timeManager = conf.timeManager;

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
          tipline('State',d.state, colorist.stateColor(d.state,'white')) +
          tipline('Capture Agent', d.eventLocation) +
          tipline('Producer',d.mediapackage.contributors.contributor) +
          tipline('Lecturer',d.mediapackage.creators.creator) +
          tipline('Workflow Duration',  timeManager.toHHMMSS(d.duration/1000)) +
          tipline('Scheduled Duration', d.scheduledDuration ?
                  timeManager.toHHMMSS(d.scheduledDuration/1000) : 'NA') +
          tipline('Lecture Start to Available Duration',
                  d.classStartToAvailableDuration ?
                  timeManager.toHHMMSS(d.classStartToAvailableDuration/1000) : 'NA', colorist.untilAvailableColor(d.classStartToAvailableDuration))+
          tipline('Lecture Start to Ready for Trim Duration',
                  d.untilReadyForTrimDuration ?
                  timeManager.toHHMMSS(d.untilReadyForTrimDuration/1000) : 'NA', colorist.untilReadyForTrimColor(d.untilReadyForTrimDuration))+          
          tipline('Row', (d.row + 1) + ' of ' + rowLength);

  }

  function operationTipText(d){
    var jobCount=0;
    if (_.has(d,'job') && d.job.children){
      jobCount = d.job.children.length;
    }
    jobCount = jobCount ? jobCount : 0;
    return '<div style="text-align:center;">Operation</div>'+
            tipline('ID',d.id, colorist.operationColor(d.id)) +
            tipline('Description', d.description) +
            tipline('State',d.state,colorist.stateColor(d.state,'white'))+
            tipline('Started', d.dateStarted)+
            tipline('Completed', d.dateCompleted) +
            tipline('Duration', timeManager.toHHMMSS(d.duration/1000)) +
            tipline('Performance Ratio', d.performanceRatio.toFixed(2)) +
             tipline('Number', d.count + ' of ' + d.workflowOperationsCount) +
             tipline('Child Jobs',''+jobCount); 
  }


  function jobTipText(d){
    var jobCount=0;
    jobCount = d.operation.job.children.length;
    var childJobsCount = 0;
      if (_.has(d,'children')){
      childJobsCount = d.children.length;
    }
    return '<div style="text-align:center;color:yellow;">Job</div>'+
            tipline('ID',d.id) +
            tipline('Job Operation', d.jobOperation) +
            tipline('Type', d.type) +
            tipline('Status',d.status)+
            tipline('Started', d.dateStarted)+
            tipline('Completed', d.dateCompleted) +          
            tipline('Duration', timeManager.toHHMMSS(d.duration/1000))  +
            tipline('Queue Time', timeManager.toHHMMSS(d.queueTime/1000)) +
            tipline('Run Time', timeManager.toHHMMSS(d.runTime/1000)) +
            tipline('Number', d.count +' of '+jobCount) +
            tipline('Child Jobs',''+ childJobsCount); 
  }

  return {  
  'jobTipText' : jobTipText,
  'commonTipText' : commonTipText,
  'operationTipText' :operationTipText,
  'tipline' : tipline,
  'toolTipSpace' : toolTipSpace
  };
}


module.exports = {  
  'createTooltipper' : createTooltipper
};
