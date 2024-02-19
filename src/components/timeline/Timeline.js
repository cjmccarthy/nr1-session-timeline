import React from 'react'
import { Stack, StackItem, Spinner } from 'nr1'
import Gauge from '../gauge/Gauge'
import eventGroup from './EventGroup'

export default class Timeline extends React.PureComponent {
  buildGauges(data) {
    const playerEvents = []
    //[[], last timestamp, buffering]
    const requestEvents = []
    //[[], last timestamp]
    const cdnEvents = []
    //[[], last timestamp]
    const ridColors = ['#1DCAD3', '#FF8300', '#03dffc', '#9003fc', '#5fa173']
    const activeRids = {}

    var currentPlayerLine = 0
    var currentRequestLine = 0
    var currentCdnLine = 0

    var globalStartTime = null
    var globalMaxTime = 0

    const overlapProtectionMs = 100
    const playerEventMinMs = 100

    data.forEach(result => {
      const sessionGroup = eventGroup(result.eventAction)
      if (sessionGroup.name === 'DATAZOOM') {
        if(!globalStartTime) {
          globalStartTime = result.timestamp
        } 

        if (result.timestamp > globalMaxTime) {
          globalMaxTime = result.timestamp
        }

        if (playerEvents.length == 0) {
          playerEvents.push({ events : [], lastTimestamp : globalStartTime, buffering : false})
          if (globalStartTime != result.timestamp) {
            this.addEmptySpace(globalStartTime, result.timestamp, globalStartTime, playerEvents[0].events)
            //TODO: -1 hack to try to not init 2 rows on first run
            playerEvents[0].lastTimestamp = result.timestamp-1
          }
        } 

        //need to search all lines for the buffering one and reset to lowest open
        if (result.actionName === 'buffer_end')
        {
          //search for buffering event line
          playerEvents.forEach((result, line) => {
            if (playerEvents[line].buffering) {
              currentPlayerLine = line
            }
          })
          //fill it with buffer color instead of space
          this.addToTimeline(globalStartTime, result.timestamp,
            playerEvents[currentPlayerLine].lastTimestamp, sessionGroup, playerEvents[currentPlayerLine].events, '#1CE783')
          //toggle buffer state
          playerEvents[currentPlayerLine].buffering = false
          playerEvents[currentPlayerLine].lastTimestamp = result.timestamp + overlapProtectionMs

        } else {
          //search for the first available line
          var availableLine = -1
          playerEvents.forEach((lineData, line) => {
            //current event is after the last event on a line and that line is not buffering
            if ((playerEvents[line].lastTimestamp < result.timestamp) && !playerEvents[line].buffering) {
              availableLine = line
            }
          })
          //if none is available, create a new line
          if (availableLine == -1) {
            playerEvents.push({ events : [], lastTimestamp : globalStartTime, buffering : false})
            currentPlayerLine = playerEvents.length-1
            //fill with empty space from the beginning
            this.addEmptySpace(globalStartTime, result.timestamp, globalStartTime, playerEvents[currentPlayerLine].events)
          } else {
            currentPlayerLine = availableLine
            //TODO: check if this inserts extra whitespace on first event
            this.addEmptySpace(globalStartTime, result.timestamp, playerEvents[currentPlayerLine].lastTimestamp, playerEvents[currentPlayerLine].events)
          }
          if (result.actionName === 'buffer_start') {
            playerEvents[currentPlayerLine].buffering = true
            playerEvents[currentPlayerLine].lastTimestamp = result.timestamp + playerEventMinMs + overlapProtectionMs
            this.addToTimeline(globalStartTime, result.timestamp + playerEventMinMs,
               result.timestamp, sessionGroup, playerEvents[currentPlayerLine].events, '#1CE783')
          } else {
            playerEvents[currentPlayerLine].lastTimestamp = result.timestamp + playerEventMinMs + overlapProtectionMs
            this.addToTimeline(globalStartTime, result.timestamp + playerEventMinMs, result.timestamp, sessionGroup, playerEvents[currentPlayerLine].events)
            this.addEmptySpace(globalMaxTime, result.timestamp + playerEventMinMs + overlapProtectionMs, result.timestamp + playerEventMinMs , playerEvents[currentPlayerLine].events )
          }

          
        }

      } else if (sessionGroup.name === 'HTTP_REQUEST') {
        if(!globalStartTime) {
          globalStartTime = result.timestamp
        } 
        if (result.end > globalMaxTime) {
          globalMaxTime = result.end
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
        requestEvents[currentRequestLine].lastTimestamp = result.end + overlapProtectionMs
        if (result.url.includes('penthera')) {
          this.addToTimeline(globalStartTime, result.end, result.timestamp, sessionGroup, requestEvents[currentRequestLine].events, '#660bb5')
        } else {
          this.addToTimeline(globalStartTime, result.end, result.timestamp, sessionGroup, requestEvents[currentRequestLine].events)
        }
        this.addEmptySpace(globalMaxTime, result.end + overlapProtectionMs, result.end, requestEvents[currentRequestLine].events )
 
      } else if (sessionGroup.name === 'CDN') {
        if(!globalStartTime) {
          globalStartTime = result.timestamp
        } 
        if (result.client_ts_ms > globalMaxTime) {
          globalMaxTime = result.client_ts_ms
        }

        if (cdnEvents.length == 0) {
          cdnEvents.push({ events : [], lastTimestamp : globalStartTime})
          if (globalStartTime != result.timestamp) {
            this.addEmptySpace(globalStartTime, result.timestamp, globalStartTime, cdnEvents[0].events)
            //TODO: -1 hack to try to not init 2 rows on first event
            cdnEvents[0].lastTimestamp = result.client_ts_ms-1
          }
        } 

        let availableLine = -1
        cdnEvents.forEach((lineData, line) => {
          //current event is after the last event on a line
          if (cdnEvents[line].lastTimestamp < result.timestamp ) {
            availableLine = line
          }
        })
        //if none is available, create a new line
        if (availableLine == -1) {
            cdnEvents.push({ events : [], lastTimestamp : globalStartTime})
            currentCdnLine = cdnEvents.length-1
            //fill with empty space from the beginning
            this.addEmptySpace(globalStartTime, result.timestamp, globalStartTime, cdnEvents[currentCdnLine].events)
        } else {
          currentCdnLine = availableLine
          //TODO: check if this inserts extra whitespace on first event
          this.addEmptySpace(globalStartTime, result.timestamp, cdnEvents[currentCdnLine].lastTimestamp, cdnEvents[currentCdnLine].events)
        }
        cdnEvents[currentCdnLine].lastTimestamp = result.client_ts_ms + overlapProtectionMs
        this.addToTimeline(globalStartTime, result.client_ts_ms, result.timestamp, sessionGroup, cdnEvents[currentCdnLine].events)
        this.addEmptySpace(globalStartTime, result.client_ts_ms + overlapProtectionMs, result.client_ts_ms, cdnEvents[currentCdnLine].events )
      }
      
    })

    playerEvents.forEach(line => {
      if (line.lastTimestamp < globalMaxTime) {
        this.addEmptySpace(globalStartTime, globalMaxTime, line.lastTimestamp, line.events)
      }
    })
    requestEvents.forEach(line => {
      if (line.lastTimestamp < globalMaxTime) {
        this.addEmptySpace(globalStartTime, globalMaxTime, line.lastTimestamp, line.events)
      }
    })
    cdnEvents.forEach(line => {
      if (line.lastTimestamp < globalMaxTime) {
        this.addEmptySpace(globalStartTime, globalMaxTime, line.lastTimestamp, line.events)
      }
    })

    return { events: [playerEvents, requestEvents, cdnEvents], globalMaxTime: globalMaxTime, globalMinTime : globalStartTime}
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

    const adjustedGlobalStart = globalMinTime + filterStartOffset
    const adjustedGlobalEnd = globalMinTime + filterEndOffset

    console.log(eventStart)
    console.log(eventEnd)
    console.log(adjustedGlobalStart)
    console.log(adjustedGlobalEnd)

    if (eventEnd <= adjustedGlobalStart) {
      console.log('event before scope')
      //event ends before filter start
      //do nothing
      return;
    } else if (eventStart >= adjustedGlobalEnd) {
      console.log('event after scope')
      //event starts after filter end
      //do nothing
      return;
    } 
    
    var newStart;
    var newEnd;
    if (eventStart < adjustedGlobalStart && eventEnd < adjustedGlobalEnd) {
      console.log('event front scope')
      //Event starts before filter start but ends before filter end
      //truncate event start time to minimum
      //subtract starting offset from end
      newStart = adjustedGlobalStart 
      newEnd = eventEnd - filterStartOffset 
    } else if (eventStart >= adjustedGlobalStart && eventEnd < adjustedGlobalEnd) {
      console.log('event in scope')
      //event starts after filter start and ends before filter end
      //subtract starting offset from start time
      //subtract starting offset from end
      newStart = eventStart - filterStartOffset
      newEnd = eventEnd - filterStartOffset
    } else if (eventStart > filterStartOffset && eventEnd > filterEndOffset) {
      console.log('event back scope')
      //event starts after filter start but ends after filter end
      //subtract starting offest from start time
      //truncate event end time to maximum
      newStart = eventStart - filterStartOffset 
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

    console.log(newEvent)

    newTimeline.push(newEvent);
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
            buffering: false
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
        {streams.events[1].map(line => { return (
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
              // title='Request Events'
            />
          </StackItem>
        )})}
        {streams.events[2].map((line, index) => { return (
          <StackItem grow fullWidth shrink >
            <Gauge
              data={line.events}
              height={20}
              showLegend={streams.events[2].length -1 == index}
              showAxis={streams.events[2].length -1 == index}
              legend={legend}
              legendClick={legendClick}
              showWarningsOnly={showWarningsOnly}
              globalMaxTime={streams.globalMaxTime}
              globalMinTime={streams.globalMinTime}
              // title='CDN Events'
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
