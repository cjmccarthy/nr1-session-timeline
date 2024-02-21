import React from 'react'
import { Stack, StackItem, Spinner } from 'nr1'
import Gauge from '../gauge/Gauge'
import eventGroup from './EventGroup'

export default class Timeline extends React.PureComponent {
  chooseColor(someString) {
    const ridColors = [
          '#2f4f4f',
          '#8b4513',
          '#6b8e23',
          '#000080',
          '#48d1cc',
          '#ffa500',
          '#00ff26',
          '#00ff00',
          '#00fa9a',
          '#0000ff',
          '#ff00ff',
          '#6495ed',
          '#ff1493',
          '#ffdab9',
          '#000000'
        ]
    let charTotal = 0
    for (let i = 0; i < someString.length; i++) {
      charTotal += someString.charCodeAt(i)
    }

    return ridColors[charTotal % ridColors.length]
  }

  buildGauges(data) {
    const customEvents = []
    const requestEvents = []
    

    var currentPlayerLine = 0
    var currentRequestLine = 0

    var globalStartTime = null
    var globalMaxTime = 0

    const overlapProtectionMs = 0

    data.forEach(result => {
      const sessionGroup = eventGroup(result.eventAction)
      if (sessionGroup.name === 'CUSTOM') {
        // console.log(result)
        if(!globalStartTime) {
          globalStartTime = result.timestamp
        } 

        var resultDuration;
        if (result['Time Elapsed'] > 0 ) {
          resultDuration = result['Time Elapsed']
        }  else {
          resultDuration = result.duration*1000
        }

        if (result.timestamp + resultDuration > globalMaxTime) {
          globalMaxTime = result.timestamp + resultDuration
        }

        // if (customEvents.length == 0) {
        //   customEvents.push({ events : [], lastTimestamp : globalStartTime})
        //   if (globalStartTime != result.timestamp) {
        //     // this.addEmptySpace(globalStartTime, result.timestamp, globalStartTime, customEvents[0].events)
        //     //TODO: -1 hack to try to not init 2 rows on first run
        //     // customEvents[0].lastTimestamp = result.timestamp-1
        //   }
        // } 

        //search for the first available line
        var availableLine = -1
        customEvents.forEach((lineData, line) => {
          //current event is after the last event on a line
          if ((customEvents[line].lastTimestamp < result.timestamp)) {
            availableLine = line
          }
        })
        //if none is available, create a new line
        if (availableLine == -1) {
          customEvents.push({ events : [], lastTimestamp : globalStartTime})
          currentPlayerLine = customEvents.length-1
          //fill with empty space from the beginning
          this.addEmptySpace(globalStartTime, result.timestamp, globalStartTime, customEvents[currentPlayerLine].events)
        } else {
          currentPlayerLine = availableLine
          //TODO: check if this inserts extra whitespace on first event
          this.addEmptySpace(globalStartTime, result.timestamp, customEvents[currentPlayerLine].lastTimestamp, customEvents[currentPlayerLine].events)
        }

        customEvents[currentPlayerLine].lastTimestamp = result.timestamp + resultDuration + overlapProtectionMs
        this.addToTimeline(globalStartTime, result.timestamp + resultDuration, result.timestamp, sessionGroup, customEvents[currentPlayerLine].events)
        if (globalMaxTime > resultDuration + result.timestamp)
          this.addEmptySpace(globalMaxTime, result.timestamp + resultDuration + overlapProtectionMs, result.timestamp, customEvents[currentPlayerLine].events )
          

      } else if (sessionGroup.name === 'AJAX' || sessionGroup.name === 'REQUEST') {
        if(!globalStartTime) {
          globalStartTime = result.timestamp
        } 

        var resultDuration;
        // var requestUrl;
        if (sessionGroup.name === 'AJAX') {
          resultDuration = 1000*result.timeToLoadEventStart
          // requestUrl = result.requestUrl
        } else {
          resultDuration = 1000*result.duration

        }

        const resultEnd = result.timestamp + resultDuration

        if (resultEnd > globalMaxTime) {
          globalMaxTime = resultEnd
        }

        if (requestEvents.length == 0) {
          requestEvents.push({ events : [], lastTimestamp : globalStartTime})
          if (globalStartTime != result.timestamp) {
            this.addEmptySpace(globalStartTime, result.timestamp, globalStartTime, requestEvents[0].events)
            //TODO: -1 hack to try to not init 2 rows on first event
            requestEvents[0].lastTimestamp = result.timestamp-1
          }
        } 

        let availableLine = -1
        requestEvents.forEach((lineData, line) => {
          //current event is after the last event on a line
          if (requestEvents[line].lastTimestamp < result.timestamp ) {
            availableLine = line
          }
        })
        //if none is available, create a new line
        if (availableLine == -1) {
            requestEvents.push({ events : [], lastTimestamp : globalStartTime})
            currentRequestLine = requestEvents.length-1
            //fill with empty space from the beginning
            this.addEmptySpace(globalStartTime, result.timestamp, globalStartTime, requestEvents[currentRequestLine].events)
        } else {
          currentRequestLine = availableLine
          //TODO: check if this inserts extra whitespace on first event
          this.addEmptySpace(globalStartTime, result.timestamp, requestEvents[currentRequestLine].lastTimestamp, requestEvents[currentRequestLine].events)
        }

        requestEvents[currentRequestLine].lastTimestamp = resultEnd + overlapProtectionMs
        this.addToTimeline(globalStartTime, resultEnd, result.timestamp, sessionGroup, requestEvents[currentRequestLine].events, this.chooseColor(result.requestUrl))
        this.addEmptySpace(globalMaxTime, resultEnd + overlapProtectionMs, resultEnd, requestEvents[currentRequestLine].events )
 
      }      
    })


    customEvents.forEach(line => {
      if (line.lastTimestamp < globalMaxTime) {
        this.addEmptySpace(globalStartTime, globalMaxTime, line.lastTimestamp, line.events)
      }
    })
    requestEvents.forEach(line => {
      if (line.lastTimestamp < globalMaxTime) {
        this.addEmptySpace(globalStartTime, globalMaxTime, line.lastTimestamp, line.events)
      }
    })

    return { events: [customEvents, requestEvents], globalMaxTime: globalMaxTime, globalMinTime : globalStartTime}
  }

  addToTimeline(globalStartTime, endTime, startTime, sessionGroup, timeline, overrideColor) {
    const value = endTime - startTime
    const eventStreamItem = {
      label: sessionGroup.timelineDisplay.label,
      value: value > 0 ? value : 1,
      color: overrideColor ? overrideColor : sessionGroup.timelineDisplay.color,
      startTime: startTime,
      endTime: endTime,
      timeSinceStart: this.getSecondsSinceStart(globalStartTime, startTime),
    }

    timeline.push(eventStreamItem)
  }

  addEmptySpace(globalStartTime, endTime, startTime, timeline) {
    const value = endTime - startTime
    const emptySpace = {
      label: 'empty',
      value: value > 0 ? value : 1,
      color: '#FFFFFF',
      startTime: startTime,
      endTime: endTime,
      timeSinceStart: this.getSecondsSinceStart(globalStartTime, endTime)
      // warnings: result['nr.warnings'] ? result['nr.warnings'] : false,
    }
    timeline.push(emptySpace)
  }


  getSecondsSinceStart = (start, current) => {
    return (current - start) / 1000
  }

  convertEvent = (timelineEvent, globalMinTime, globalMaxTime, filterStartOffset, filterEndOffset, newTimeline) => {
    const eventStart = timelineEvent.startTime
    const eventEnd = timelineEvent.endTime

    // console.log(timelineEvent)

    const adjustedGlobalStart = globalMinTime + filterStartOffset
    const adjustedGlobalEnd = globalMinTime + filterEndOffset

    

    if (eventEnd <= adjustedGlobalStart) {
      //event ends before filter start
      //do nothing
      // console.log('event before scope')
      return;
    } else if (eventStart >= adjustedGlobalEnd) {
      //event starts after filter end
      //do nothing
      // console.log('event after scope')
      return;
    } 
    
    var newStart;
    var newEnd;
    if (eventStart < adjustedGlobalStart && eventEnd <= adjustedGlobalEnd) {
      //Event starts before filter start but ends before filter end
      //truncate event start time to minimum
      //subtract starting offset from end
      console.log('event overlaps beginning scope')
      newStart = adjustedGlobalStart 

      //TODO check
      newEnd = eventEnd
    } else if (eventStart >= adjustedGlobalStart && eventEnd <= adjustedGlobalEnd) {
      //event starts after filter start and ends before filter end
      //subtract starting offset from start time
      //subtract starting offset from end
      console.log('event totally in scope')
      newStart = eventStart// - filterStartOffset
      newEnd = eventEnd// - filterStartOffset
    } else if (eventStart >= adjustedGlobalStart && eventEnd >= adjustedGlobalEnd) {
      console.log('event overlaps end scope')
      //event starts after filter start but ends after filter end
      //subtract starting offest from start time
      //truncate event end time to maximum
      newStart = eventStart
      newEnd = adjustedGlobalEnd

    } else if (eventStart <= adjustedGlobalStart && eventEnd >= adjustedGlobalEnd) {
      console.log('event totally overlaps')
      newStart = adjustedGlobalStart
      newEnd = adjustedGlobalEnd
    }

    const newEvent = {
      label: timelineEvent.label,
      value: newEnd - newStart,
      color: timelineEvent.color,
      startTime: newStart,
      endTime: newEnd,
      timeSinceStart: this.getSecondsSinceStart(adjustedGlobalStart, newStart),
    }


    console.log(`event start ${eventStart} event end ${eventEnd}`)
    console.log(`new global start ${adjustedGlobalStart} new global end ${adjustedGlobalEnd}`)
    console.log(newEvent)

    if (newEvent.value) newTimeline.push(newEvent);
  }

  filterStreams = (streams, filterStartTime, filterEndTime) => {
    let newEvents = []
    
    for (let i = 0; i < streams.events.length; i++) {
      const newStream = []
      streams.events[i].forEach((streamLine) => {
        let newLine = []
        streamLine.events.forEach((e) =>
          this.convertEvent( e, 
          streams.globalMinTime, streams.globalMaxTime, 
          filterStartTime, filterEndTime, 
          newLine))
        if (newLine.length) {
          newStream.push({
            events: newLine,
            lastTimestamp: streamLine.lastTimestamp,
          })
        }
      })
      newEvents.push(newStream)
    }

    return { 
      events: newEvents, 
      globalMaxTime: (filterEndTime > streams.globalMaxTime) ? streams.globalMaxTime : streams.globalMinTime+filterEndTime, 
      globalMinTime : streams.globalMinTime+filterStartTime
    }
  }

  render() {
    const { data, loading, legend, legendClick, showWarningsOnly, filterStartTime, filterEndTime } = this.props

    const rawStreams = this.buildGauges(data)

    const streams = this.filterStreams(rawStreams, filterStartTime, filterEndTime)
    console.log(streams)

    const gaugeContent = loading ? (
      <Spinner />
    ) : !loading && streams.events.length > 0 ? (
      <Stack
        fullWidth
        directionType={Stack.DIRECTION_TYPE.VERTICAL}
        verticalType={Stack.VERTICAL_TYPE.CENTER}
        horizontalType={Stack.HORIZONTAL_TYPE.FILL}
        spacingType={Stack.SPACING_TYPE.OMIT}
        gapType={Stack.GAP_TYPE.NONE}
      >
        {streams.events[0].map(line => { return (
          <StackItem grow fullWidth shrink>
            <Gauge
              data={line.events }
              height={20}
              showLegend={false}
              showAxis={false}
              legend={legend}
              legendClick={legendClick}
              showWarningsOnly={showWarningsOnly}
              globalMaxTime={streams.globalMaxTime}
              globalMinTime={streams.globalMinTime}
              // title='Player Events'
            />
          </StackItem>
        )})}
        {streams.events[1].map((line, index) => { return (
          <StackItem grow fullWidth shrink>
            <Gauge
              data={line.events }
              height={20}
              showLegend={streams.events[1].length - 1 == index}
              showAxis={streams.events[1].length - 1 == index}
              legend={legend}
              legendClick={legendClick}
              showWarningsOnly={showWarningsOnly}
              globalMaxTime={streams.globalMaxTime}
              globalMinTime={streams.globalMinTime}
              filterOffset={filterStartTime}
              // title='Request Events'
            />
          </StackItem>
        )})}
      </Stack>
    ) : (
      <Stack
        fullWidth
        className="emptyState timelineEmptyState"
        directionType={Stack.DIRECTION_TYPE.VERTICAL}
        verticalType={Stack.VERTICAL_TYPE.CENTER}
        horizontalType={Stack.HORIZONTAL_TYPE.CENTER}
      >
        <StackItem>
          <p className="emptyStateHeader">Could not load session timeline</p>
        </StackItem>
      </Stack>
    )

    return (
      <div>
        <Stack
          className="gaugeStack"
          directionType={Stack.DIRECTION_TYPE.VERTICAL}
        >
          <StackItem className="gaugeStackItem sessionSectionBase">
            {gaugeContent}
          </StackItem>
        </Stack>
      </div>
    )
  }
}
