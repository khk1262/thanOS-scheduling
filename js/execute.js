﻿/*
입력:
프로세스개수 n
도착시간배열 arrivals[2, 5, ...]
수행시간배열 bursts[3, 7, ...]
출력:
대기시간배열 waitings[]
수행시간배열 turnArounds[]
프로세서상태 pStates[ [processIdx, timeStart, timeStay], ... ]
*/

function getProcesses(cntProcess, arrivals, bursts) {
    let processes = [];
    for (let i = 1; i <= cntProcess; ++i) {
        processes.push({ pid: i, arrival: arrivals[i], burst: bursts[i] });
    }
    return processes;
}

/***************************************************
 *
 *  FCFS
 *
 ***************************************************/
function FCFS(cntProcess, arrivals, bursts) {
    let processes = getProcesses(cntProcess, arrivals, bursts);
    processes.sort((a, b) => a.arrival - b.arrival ? a.arrival - b.arrival : a.pid - b.pid);

    let waitings = [null], turnArounds = [null], pStates = [];
    let time = 0;

    for (let i = 0; i < cntProcess; ++i) {
        // i번째로 들어온 프로세스 수행
        let now = processes[i];

        if (time < now.arrival) {
            pStates.push([null, time, now.arrival - time]);
            time = now.arrival;
        }

        turnArounds[now.pid] = time + now.burst - now.arrival;
        waitings[now.pid] = turnArounds[now.pid] - bursts[now.pid];
        pStates.push([now.pid, time, now.burst]);

        time += now.burst;
    }

    return [waitings, turnArounds, pStates];
}

/***************************************************
 *
 *  RR
 *
 ***************************************************/
function RR(cntProcess, arrivals, bursts, delta) {
    let processes = getProcesses(cntProcess, arrivals, bursts);
    // remain : 남은 시간
    processes = processes.map(p => {
        return { pid: p.pid, arrival: p.arrival, burst: p.burst, remain: p.burst };
    });
    // 도착시간 기준 정렬
    processes.sort((a, b) => a.arrival - b.arrival ? a.arrival - b.arrival : a.pid - b.pid);
    let time = 0;
    let waitings = [null], turnArounds = [null], pStates = [];
    let readyQ = [];
    while (processes.length || readyQ.length) {
        let preemption = false;  // 끝내고 나온 프로세스가 있는지 검사
        if (readyQ.length) {
            let now = readyQ[0];
            if (now.remain <= delta) {  // 프로세스 종료
                pStates.push([now.pid, time, now.remain]);
                time += now.remain;
                turnArounds[now.pid] = time - now.arrival;
                waitings[now.pid] = turnArounds[now.pid] - now.burst;
                readyQ.shift();
            } else {  // 프로세스 지속
                pStates.push([now.pid, time, delta]);
                time += delta;
                now.remain -= delta;
                preemption = true;
            }
        } else if (processes[0].arrival > time) {  // CPU Idle
            pStates.push([null, time, processes[0].arrival - time]);
            time = processes[0].arrival;
        }
        // 프로세스 readyQ에 추가
        while (processes.length && processes[0].arrival <= time)
            readyQ.push(processes.shift());
        if (preemption) {
            readyQ.push(readyQ.shift());
            preemption = false;
        }
    }
    return [waitings, turnArounds, pStates];
}

/***************************************************
 *
 *  SPN
 *
 ***************************************************/
function SPN(cntProcess, arrivals, bursts) {
    let processes = getProcesses(cntProcess, arrivals, bursts);
    let waitings = [null], turnArounds = [null], pStates = [];
    let time = 0;

    while (1) {
        let readyQ = [], fastTime = Infinity;
        for (let i = 0; i < cntProcess; ++i) if (processes[i].burst > 0) {
            fastTime = Math.min(fastTime, processes[i].arrival);
            if (processes[i].arrival <= time) readyQ.push(i);
        }

        if (fastTime === Infinity) break;

        if (readyQ.length == 0) {
            pStates.push([null, time, fastTime - time]);
            time = fastTime;
        }
        else {
            let len = Infinity, idx = -1;
            for (let i = 0; i < readyQ.length; ++i) {
                let now = processes[readyQ[i]];
                let nowLen = now.burst;

                if (len > nowLen || len == nowLen && now.pid < processes[idx].pid) {
                    len = nowLen;
                    idx = readyQ[i];
                }
            }

            let now = processes[idx];
            pStates.push([now.pid, time, now.burst]);
            time += now.burst;
            turnArounds[now.pid] = time - now.arrival;
            waitings[now.pid] = turnArounds[now.pid] - now.burst;

            now.burst = 0;
        }
    }

    return [waitings, turnArounds, pStates];
}


/***************************************************
 *
 *  SRTN
 *
 ***************************************************/
function SRTN(cntProcess, arrivals, bursts) {
    let processes = getProcesses(cntProcess, arrivals, bursts);
    let waitings = [null], turnArounds = [null], pStates = [];
    let time = 0;
    arrivals = Array.from(arrivals);

    arrivals.shift();
    arrivals = Array.from(new Set(arrivals));
    arrivals.push(Infinity);
    arrivals.sort((a, b) => a - b);

    for (let i = 0; i < arrivals.length - 1; ++i) {
        // eventTime = 이벤트가 발생한 시간
        let eventTime = arrivals[i];
        let readyQ = [];
        let nextTime = arrivals[i + 1];

        for (let j = 0; j < cntProcess; ++j)
            if (processes[j].arrival <= eventTime && processes[j].burst > 0) readyQ.push(j);

        // 지금부터 다음 이벤트가 발생하기 전까지는 burst 가장 짧은 놈을 계속 돌린다
        while (time < nextTime) {
            if (time < eventTime) {
                pStates.push([null, time, eventTime - time]);
                time = eventTime;
            }

            let idx = -1, max = Infinity;
            for (let j = 0; j < readyQ.length; ++j) {
                let now = processes[readyQ[j]];
                if (now.burst > 0 && (now.burst < max || now.burst == max && now.pid < processes[idx].pid)) {
                    max = now.burst;
                    idx = readyQ[j];
                }
            }

            if (idx === -1) break;

            // idx번째가 가장 짧은 놈
            let exec = Math.min(nextTime - time, processes[idx].burst);
            pStates.push([processes[idx].pid, time, exec]);
            time += exec;
            processes[idx].burst -= exec;

            if (processes[idx].burst === 0) {
                let pid = processes[idx].pid;
                turnArounds[pid] = time - processes[idx].arrival;
                waitings[pid] = turnArounds[pid] - bursts[pid];
            }
        }
    }

    let tmp = [pStates[0]], p = 0;
    for (let i = 1; i < pStates.length; ++i) {
        if (tmp[p][0] === pStates[i][0]) tmp[p][2] += pStates[i][2];
        else tmp.push(pStates[i]), ++p;
    }

    pStates = tmp;

    return [waitings, turnArounds, pStates];
}


/***************************************************
 *
 *  HRRN
 *
 ***************************************************/
function HRRN(cntProcess, arrivals, bursts) {
    let processes = getProcesses(cntProcess, arrivals, bursts);
    let waitings = [null], turnArounds = [null], pStates = [];
    let time = 0;

    while (true) {
        let readyQ = [], fastTime = Infinity;
        for (let i = 0; i < cntProcess; ++i)
            if (processes[i].burst > 0) {
                fastTime = Math.min(fastTime, processes[i].arrival);
                if (processes[i].arrival <= time)
                    readyQ.push(i);
            }

        if (fastTime === Infinity) break;

        if (readyQ.length == 0) {
            pStates.push([null, time, fastTime - time]);
            time = fastTime;
        }
        else {
            let hrrn = 0, idx = -1;
            for (let i = 0; i < readyQ.length; ++i) {
                let now = processes[readyQ[i]];
                let nowHrrn = (time - now.arrival + now.burst) / now.burst;

                if (nowHrrn > hrrn || nowHrrn == hrrn && now.pid < processes[idx].pid) {
                    hrrn = nowHrrn;
                    idx = readyQ[i];
                }
            }

            let now = processes[idx];
            pStates.push([now.pid, time, now.burst]);
            time += now.burst;
            turnArounds[now.pid] = time - now.arrival;
            waitings[now.pid] = turnArounds[now.pid] - now.burst;

            now.burst = 0;
        }
    }

    return [waitings, turnArounds, pStates];
}

function InfinityGauntlet(cntProcess, arrivals, bursts) {
    let processes = getProcesses(cntProcess, arrivals, bursts);

    // 랜덤하게 절반 프로세스 삭제
    processes.sort(() => Math.random() - 0.5);
    let killed = []; // 죽은 프로세스
    let killCnt = Math.floor(cntProcess / 2);
    cntProcess -= killCnt;
    while (killCnt-- > 0)
        killed.push(processes.shift());
    killed = killed.map(x => x.pid);
    killed.sort((a, b) => a - b);


    // 남은 프로세스는 FCFS로 처리
    processes.sort((a, b) => a.arrival - b.arrival ? a.arrival - b.arrival : a.pid - b.pid);

    let waitings = [null], turnArounds = [null], pStates = [];
    let time = 0;

    for (let i = 0; i < cntProcess; ++i) {
        let now = processes[i];

        if (time < now.arrival) {
            pStates.push([null, time, now.arrival - time]);
            time = now.arrival;
        }

        turnArounds[now.pid] = time + now.burst - now.arrival;
        waitings[now.pid] = turnArounds[now.pid] - bursts[now.pid];
        pStates.push([now.pid, time, now.burst]);

        time += now.burst;
    }

    return [waitings, turnArounds, pStates, killed];
}
