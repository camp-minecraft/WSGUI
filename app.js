//https://babeljs.io/repl#?browsers=defaults%2C%20not%20ie%2011%2C%20not%20ie_mob%2011&build=&builtIns=false&corejs=3.21&spec=false&loose=false&code_lz=Q&debug=false&forceAllTransforms=false&shippedProposals=false&circleciRepo=&evaluate=false&fileSize=false&timeTravel=false&sourceType=module&lineWrap=true&presets=react&prettier=false&targets=&version=7.20.4&externalPlugins=&assumptions=%7B%7D
//でトランスパイルしてからscript.htmlにペースト

// const { FormControl, InputLabel, FilledInput, InputAdornment } = MaterialUI;
// const { DataGrid, GridColDef, GridRowsProp } = MaterialUI;

var ws;

function generateUuid() {
    // const FORMAT: string = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
    let chars = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".split("");
    for (let i = 0, len = chars.length; i < len; i++) {
        switch (chars[i]) {
            case "x":
                chars[i] = Math.floor(Math.random() * 16).toString(16);
                break;
            case "y":
                chars[i] = (Math.floor(Math.random() * 4) + 8).toString(16);
                break;
        }
    }
    return chars.join("");
}

class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            mode: "Overview",
            minecraftClientList: [],
            groupList: ["A", "B", "C", "D", "E", "F", "G", "H", "I"],
            currentCommandSet: [],
            currentCommandSetId: "",
            currentResponseList: [],
            wsStatus: "",
        }

        //wsをグローバルに配置できないか検討
        ws = new WebSocket("ws://localhost:9999");

        //ws.onopenとws.onmessageをグローバルに配置できないか検討
        ws.onopen = (event) => {
            console.log("Websocket接続が開始しました")
            this.setState({
                wsStatus: event.currentTarget.url,
            })
        }
        ws.onmessage = (message) => {
            let data;
            try {
                data = JSON.parse(message.data);
            } catch (error) {
                console.log("送られたデータはJSONではありません。");
                console.log(message);
                return
            }
            if (data.header.messagePurpose == undefined) {
                console.log("messagePurposeが定義されていません。")
                return
            }
            switch (data.header.messagePurpose) {
                case "submitMinecraftClientList":
                    console.log("submitMinecraftClientList");
                    console.log(data.body.clientList);
                    this.setState({
                        minecraftClientList: data.body.clientList,
                    })
                    break;

                case "submitPlayerList":
                    /*
                    dataは以下の形式
                    {
                        header: {
                            messagePurpose: "submitPlayerList"
                        },
                        body: {
                            minecraftWebsocketId: sendMinecraftWebsocketId,
                            players: data.body.details,
                            groupIndex: client.groupIndex,
                        }
                    }
                    */

                    console.log(data);

                    // if(data.body.groupIndex !== undefined) break;

                    this.state.minecraftClientList.forEach((client) => {
                        console.log("現在のクライアントリストと送られてきたデータを比較")
                        console.log(`${client.minecraftWebsocketId} | ${data.body.minecraftWebsocketId}`)
                        if (client.minecraftWebsocketId == data.body.minecraftWebsocketId) {
                            console.log("Player名を追加")
                            console.log(data.body.players)
                            client.player = data.body.players;
                        }
                    })
                    this.forceUpdate();
                    break;

                case "linkCommandSet":
                    /*
                    {
                        header:{
                            messagePurpose:"linkCommandSet",
                        },
                        body:{
                            commandId:JSON.parse(sendData).header.requestId,
                            commandSetId:commandSetId,
                            minecraftWebsocketId: client.minecraftWebsocketId,
                            groupIndex: client.groupIndex,
                        }
                    }
                    */
                    console.log("linkCommandSet")
                    console.log(data)
                    if (data.body.commandSetId === this.state.currentCommandSetId) {
                        this.setState({
                            currentCommandSet: [...this.state.currentCommandSet,
                            {
                                commandId: data.body.commandId,
                                minecraftWebsocketId: data.body.minecraftWebsocketId,
                                groupIndex: data.body.groupIndex,
                                commandSetId: data.body.commandSetId,
                            }]
                        })
                    }

                    break;

                case "commandResponse":
                    console.log("commandResponse")
                    console.log(data)

                    this.state.currentCommandSet.forEach((commandSet) => {
                        if (commandSet.commandId === data.header.requestId) {
                            data.header.groupIndex = commandSet.groupIndex;
                            this.setState({
                                currentResponseList: [...this.state.currentResponseList, data]
                            })
                        }
                    })
                    if (!data.header.groupIndex) {
                        console.log(`${data.header.requestId}は最新のコマンドセットに含まれていませんでした。`)
                    }

                    break;

                default:
                    if (!!data.header.messagePurpose) {
                        console.log(`${data.header.messagePurpose}の処理が実装されていません。`)
                    } else {
                        console.log("messagePurposeが定義されていません。")
                    }
                    break;
            }
            if (typeof (message.data) != "string") {
                message.data.text().then(text =>
                    console.log(text)
                    // console.log(JSON.parse(text))
                ).catch(error =>
                    console.log(error)
                )
            }
        }

        ws.onclose = (event) => {
            console.log(event);
            this.setState({
                wsStatus: "disconnected"
            })
        }
    }

    resetCurrentCommandSet = () => {
        this.setState({
            currentCommandSet: [],
            currentResponseList: [],
        })
    }

    setCurrentCommandSetId = (commandSetId) => {
        this.setState({
            currentCommandSetId: commandSetId,
        })
    }

    submitGroup = async (groupIndex, minecraftWebsocketIdList) => {
        ws.send(JSON.stringify({
            header: {
                messagePurpose: "submitGroup",
            },
            body: {
                groupIndex: groupIndex,
                minecraftWebsocketIdList: minecraftWebsocketIdList,
            }
        }))
        let targetClient = this.state.minecraftClientList.filter((client, index) => {
            return minecraftWebsocketIdList.includes(client.minecraftWebsocketId)
        })

        await this.setState({
            minecraftClientList: this.state.minecraftClientList.filter((client, index) => {
                return !minecraftWebsocketIdList.includes(client.minecraftWebsocketId)
            })
        })
        targetClient.forEach((client) => {
            client.group = groupIndex;
        })
        console.log(targetClient);
        await this.setState({
            minecraftClientList: [...this.state.minecraftClientList, ...targetClient]
        })
    }

    setMode = (newMode) => {
        this.setState({
            mode: newMode
        })
    }

    render() {
        return (
            <main>
                <ModeWrapper
                    setMode={(newMode) => this.setMode(newMode)}
                    globalMode={this.state.mode}
                />
                <WebsocketStatus
                    wsStatus={this.state.wsStatus}
                />
                <ViewWrapper
                    mode={this.state.mode}
                    minecraftClientList={this.state.minecraftClientList}
                    groupList={this.state.groupList}
                    submitGroup={(groupIndex, minecraftWebsocketId) => this.submitGroup(groupIndex, minecraftWebsocketId)}
                    setCurrentCommandSetId={(commandSetId) => this.setCurrentCommandSetId(commandSetId)}
                    currentCommandSet={this.state.currentCommandSet}
                    currentResponseList={this.state.currentResponseList}
                    resetCurrentCommandSet={() => this.resetCurrentCommandSet()}
                />
            </main>
        )
    }
}

class WebsocketStatus extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div className="websocket-status-wrapper">
                <WebsocketStatusBadge
                    wsStatus={this.props.wsStatus}
                />
                <WebsocketStatusMessage
                    wsStatus={this.props.wsStatus}
                />
            </div>
        )
    }
}

class WebsocketStatusBadge extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        let wsStatusClass;
        if (this.props.wsStatus === "disconnected") {
            wsStatusClass = "websocket-disconnected"
        } else {
            wsStatusClass = ""
        }
        return (
            <div className={`websocket-status-badge ${wsStatusClass}`}></div>
        )
    }
}

class WebsocketStatusMessage extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        let wsStatusMessage;
        if (this.props.wsStatus === "disconnected") {
            wsStatusMessage = "CAMPサーバーとの接続が切れました"
        } else {
            wsStatusMessage = "CAMPサーバーと接続中"
        }
        return (
            <div className="websocket-status-message">
                {wsStatusMessage}
            </div>
        )
    }
}

class ViewWrapper extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        //モードを追加したらここにViewコンポーネントを設定
        const ViewComponents = {
            Overview: <OverviewView
                minecraftClientList={this.props.minecraftClientList}
                groupList={this.props.groupList}
            />,
            Command: <CommandView
                groupList={this.props.groupList}
                setCurrentCommandSetId={(commandSetId) => this.props.setCurrentCommandSetId(commandSetId)}
                currentCommandSet={this.props.currentCommandSet}
                currentResponseList={this.props.currentResponseList}
                resetCurrentCommandSet={() => this.props.resetCurrentCommandSet()}
            />,
            Submit: <SubmitView
                minecraftClientList={this.props.minecraftClientList}
                groupList={this.props.groupList}
                submitGroup={(groupIndex, minecraftWebsocketId) => this.props.submitGroup(groupIndex, minecraftWebsocketId)}
            />
        }
        return (
            ViewComponents[this.props.mode]
        )
    }
}

class OverviewView extends React.Component {
    constructor(props) {
        super(props)
    }
    render() {
        return (
            <div className="view-wrapper">
                <GroupCardWrapper
                    groupList={this.props.groupList}
                    minecraftClientList={this.props.minecraftClientList}
                />
            </div>
        )
    }
}

class GroupCardWrapper extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div className="group-wrapper">
                {
                    this.props.groupList.map((group) => {
                        return <GroupCard
                            groupIndex={group}
                            minecraftClientList={this.props.minecraftClientList}
                        />
                    })
                }
            </div>
        )
    }
}

class CommandView extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            destination: new Map(),
            command: "",
            lastCommandSetId: "",
        }
    }
    updateDestination = (destination) => {
        this.setState({
            destination: destination
        });
    }

    updateCommand = (command) => {
        this.setState({
            command: command
        });
    }

    sendCommand = (command, destination) => {
        console.log(command, destination);
        const commandSetId = generateUuid();
        ws.send(
            JSON.stringify({
                "header": {
                    messagePurpose: "GAS Request",
                    commandSetId: commandSetId,
                },
                "body": {
                    command: command,
                    destination: destination,
                }
            })
        )
        // return new Promise(
        //     (res) => {
        //         return res;
        //     },
        //     (error) => {
        //         return "error:" + error;
        //     });
        return commandSetId;
    }

    updateLastCommandSetId = (lastCommandSetId) => {
        this.setState({
            lastCommandSetId: lastCommandSetId,
        });
        this.props.setCurrentCommandSetId(lastCommandSetId);
    }

    render() {
        return (
            <div className="view-wrapper" >
                <CurrentCommandCard
                    lastCommandSetId={this.state.lastCommandSetId}
                    currentCommandSet={this.props.currentCommandSet}
                    currentResponseList={this.props.currentResponseList}
                    currentCommand={this.state.command}
                />
                <CommandField
                    updateCommand={(command) => this.updateCommand(command)}
                    sendCommand={(command, destination) => this.sendCommand(command, destination)}
                    command={this.state.command}
                    destination={this.state.destination}
                    updateLastCommandSetId={(lastCommandSetId) => this.updateLastCommandSetId(lastCommandSetId)}
                    resetCurrentCommandSet={() => this.props.resetCurrentCommandSet()}
                />
                <DestinationSelectorWrapper
                    updateDestination={(destination) => this.updateDestination(destination)}
                />
            </div>
        )
    }
}

class SubmitView extends React.Component {
    constructor(props) {
        console.log(props);
        super(props);
        this.state = {
            selectedClientList: [],
        }
    }

    toggleSelectedClient = (selectedClient, isSelected) => {
        if (!isSelected) {
            this.setState({
                selectedClientList: [...this.state.selectedClientList, selectedClient]
            })
        } else {
            this.setState({
                selectedClientList: this.state.selectedClientList.filter((client, index) => (client !== selectedClient)),
            })
        }
    }

    resetSelectedClientList = () => {
        this.setState({
            selectedClientList: [],
        })
    }

    render() {
        return (
            <div className="view-wrapper submit-view">
                <ClientTable
                    minecraftClientList={this.props.minecraftClientList}
                    selectedClientList={this.state.selectedClientList}
                    toggleSelectedClient={(selectedClient, isSelected) => this.toggleSelectedClient(selectedClient, isSelected)}
                />
                <SubmitGroup
                    selectedClientList={this.state.selectedClientList}
                    groupList={this.props.groupList}
                    submitGroup={(groupIndex, minecraftWebsocketId) => this.props.submitGroup(groupIndex, minecraftWebsocketId)}
                    resetSelectedClientList={() => this.resetSelectedClientList()}
                />
            </div>
        )
    }
}

class GroupCard extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div className="group-card">
                <div className="group-card-index">{this.props.groupIndex}</div>
                {this.props.minecraftClientList.map((client) => {
                    if (client.group !== this.props.groupIndex) return;
                    return (
                        <GroupCardClient
                            client={client}
                        />
                    )
                })}
            </div>
        )
    }
}

class GroupCardClient extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div className="group-card-client">
                <div className="group-card-client-name">
                    {this.props.client.player}
                </div>
            </div>
        )
    }
}

class ClientTable extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div>
                <div className="client-header">
                    <div className="client-player">プレーヤー</div>
                    <div className="client-connection-time">接続時間</div>
                    <div className="client-uuid">接続ID</div>
                </div>
                <div className="client-table">
                    {this.props.minecraftClientList.map((client) => {
                        if (!!client.group) return;
                        return (
                            <ClientRaw
                                isSelected={this.props.selectedClientList.includes(client.minecraftWebsocketId)}
                                toggleSelectedClient={(selectedClient, isSelected) => this.props.toggleSelectedClient(selectedClient, isSelected)}
                                currentTime={new Date().getTime()}
                                clientInfo={client}
                                key={client.minecraftWebsocketId}
                            />
                        )
                    })}
                </div>
            </div>
        )
    }
}

class ClientRaw extends React.Component {
    constructor(props) {
        super(props);

    }

    toggleSelected = () => {
        this.props.toggleSelectedClient(this.props.clientInfo.minecraftWebsocketId, this.props.isSelected);
    }

    render() {
        var timeDiff = (this.props.currentTime - this.props.clientInfo.connectedTime) / 1000;
        timeDiff = Math.round(timeDiff);
        if (timeDiff >= 60) {
            timeDiff = `${~~(timeDiff / 60)}分`
        } else if (timeDiff > 10) {
            timeDiff = `${(timeDiff % 60).toString()}秒`
        } else {
            timeDiff = "今"
        }

        return (
            <div
                className={"client-row " + (this.props.isSelected ? "client-selected" : "")}
                onClick={this.toggleSelected}
            >
                <div className="client-player">{this.props.clientInfo.player}</div>
                <div className="client-connection-time">
                    {`${timeDiff}`}
                </div>
                <div className="client-uuid">{this.props.clientInfo.minecraftWebsocketId}</div>
            </div>
        )
    }
}

class SubmitGroup extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            selectedGroup: "A",
        }
    }

    changeSelectedGroup = (newSelectedGroup) => {
        this.setState({
            selectedGroup: newSelectedGroup,
        })
    }

    submitGroup = () => {
        console.log(this.state.selectedGroup);
        console.log(this.props.selectedClientList);
        this.props.submitGroup(this.state.selectedGroup, this.props.selectedClientList)
    }

    render() {
        const isSubmitable = !!this.props.selectedClientList.length && !!this.state.selectedGroup;
        return (
            <div className="submit-group">
                <GroupList
                    groupList={this.props.groupList}
                    selectedGroup={this.state.selectedGroup}
                    changeSelectedGroup={(newSelectedGroup) => this.changeSelectedGroup(newSelectedGroup)}
                />
                <GroupSubmitButton
                    isSubmitable={isSubmitable}
                    submitGroup={this.submitGroup}
                    resetSelectedClientList={() => this.props.resetSelectedClientList()}
                />
            </div>
        )
    }
}

class GroupList extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div className="group-list">
                {this.props.groupList.map((group) => {
                    return (
                        <GroupElement
                            selectedGroup={this.props.selectedGroup}
                            key={group}
                            group={group}
                            changeSelectedGroup={(newSelectedGroup) => this.props.changeSelectedGroup(newSelectedGroup)}
                        />
                    )
                })}
            </div>
        )
    }
}

class GroupElement extends React.Component {
    constructor(props) {
        super(props);
    }

    changeSelectedGroup = () => {
        this.props.changeSelectedGroup(this.props.group);
    }

    render() {
        return (
            <div
                className={"grouplist-element " + (this.props.group === this.props.selectedGroup ? "client-selected" : "")}
                onClick={this.changeSelectedGroup}>
                {this.props.group}
            </div>
        )
    }
}

class GroupSubmitButton extends React.Component {
    constructor(props) {
        super(props);
    }

    submitGroup = () => {
        if (this.props.isSubmitable) {
            this.props.submitGroup()
            this.props.resetSelectedClientList()
        }
    }

    render() {
        return (
            <div
                className={"group-submit-button " + (this.props.isSubmitable ? "" : "group-submit-button-disable")}
                onClick={this.submitGroup}
            >
                登録
            </div>
        )
    }
}

class DestinationSelectorWrapper extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            groupList: [
                "Aグループ",
                "Bグループ",
                "Cグループ",
                "Dグループ",
            ],
            isAll: false,
            statusHolder: new Map(),
        }
        this.state.groupList.forEach((element) => {
            this.state.statusHolder.set(element, false);
        })
    }

    setStatus = (group, isSelected) => {
        this.setState({
            statusHolder: this.state.statusHolder.set(group, isSelected),
        })
    }

    setAllStatus = (status) => {
        const newStatusHolder = new Map();
        this.state.groupList.forEach((group) => {
            newStatusHolder.set(group, status);
        })
        this.setState({
            statusHolder: newStatusHolder,
        })
    }

    setAll = (isAll) => {
        this.setState({
            isAll: isAll
        })
    }

    render() {
        return (
            <div className="destination-wrapper">
                <div>
                    <DestinationSelector
                        label="全ての生徒"
                        key="全ての生徒"
                        isAll={this.state.isAll}
                        setAll={(isAll) => this.setAll(isAll)}
                        setStatus={(group, isSelected) => this.setStatus(group, isSelected)}
                        setAllStatus={(status) => this.setAllStatus(status)}
                        statusHolder={this.state.statusHolder}
                        updateDestination={(destination) => this.props.updateDestination(destination)}
                    />
                </div>
                <div className="group-destination">
                    {this.state.groupList.map((groupName) => {
                        return (
                            <DestinationSelector
                                label={groupName}
                                key={groupName}
                                isAll={this.state.isAll}
                                setAll={(isAll) => this.setAll(isAll)}
                                setStatus={(group, isSelected) => this.setStatus(group, isSelected)}
                                setAllStatus={(status) => this.setAllStatus(status)}
                                statusHolder={this.state.statusHolder}
                                updateDestination={(destination) => this.props.updateDestination(destination)}
                            />
                        )
                    })}
                </div>
            </div>
        )
    }
}

class DestinationSelector extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            isSelected: false,
        }
    }

    shouldComponentUpdate(e, f) {
        if (this.props.label == "全ての生徒") {
            if (!e.isAll && this.state.isSelected) {
                this.setState({
                    isSelected: false,
                })
            }
        }
        if (e.isAll && !this.state.isSelected) {
            this.setState({
                isSelected: true,
            })
        }
        // if(this.props.label=="Aグループ") console.log(e,f);
        // this.props.updateDestination(this.props.statusHolder);
        return true;
    }

    toggleSelected = async () => {
        if (this.props.label != "全ての生徒") {
            this.setState({
                isSelected: this.props.statusHolder.get(this.props.label)
            })
            this.props.setStatus(this.props.label, !this.props.statusHolder.get(this.props.label));
            if (Array.from(this.props.statusHolder.values()).every(Boolean)) {
                this.props.setAll(true);
            } else {
                this.props.setAll(false);
            }
        } else {
            this.props.setAll(!this.props.isAll);
            await this.props.setAllStatus(!this.props.isAll);
        }
        this.props.updateDestination(this.props.statusHolder);
    }

    render() {
        return (
            <div className={"selectable-button " +
                (this.props.statusHolder.get(this.props.label) ||
                    Array.from(this.props.statusHolder.values()).every(Boolean)
                    ? "is-selected-destination" : "")}
                onClick={this.toggleSelected}>
                {this.props.label}
            </div>
        )
    }
}

class CommandField extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            value: "",
            isValid: false,
            lastCommandSetId: "",
        }
    }

    handleChange = (e) => {
        this.setState({ value: e.target.value });

    }
    handleSubmit = async (e) => {
        if (this.state.value === "") {
            return e.preventDefault();
        }
        await this.props.updateCommand(this.state.value);
        await this.setState({
            isValid: !(Array.from(this.props.destination.values()).every((element) => {
                return !element;
            }))
        })
        this.setState({ value: "" });
        let res = await this.props.sendCommand(this.props.command, this.props.destination);
        this.props.updateLastCommandSetId(res);
        this.props.resetCurrentCommandSet();
        return e.preventDefault();
    }

    render() {
        return (
            <div>
                <form onSubmit={this.handleSubmit} id="command-form">
                    <div>/</div>
                    <input type="text" value={this.state.value} onChange={this.handleChange} />
                    <input type="submit" value="送信" />
                </form>
            </div>
        )
    }
}

class CurrentCommandCard extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        const dt = new Date();
        const currentTime = `${dt.getHours().toString()}:${dt.getMinutes().toString()}`
        return (
            <div className="current-command-card">
                <div>
                    <div>
                        {currentTime}
                    </div>
                    <div>
                        {this.props.lastCommandSetId}
                    </div>
                </div>
                <div>
                    <span>{`/${this.props.currentCommand}`}</span>
                    <img className="copy-icon" src="https://img.icons8.com/material-rounded/24/000000/copy.png" />
                </div>
                <StatusWrapper
                    currentCommandSet={this.props.currentCommandSet}
                    currentResponseList={this.props.currentResponseList}
                />
            </div>
        )
    }
}

class StatusWrapper extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        let responseStatusCodeList = this.props.currentResponseList.map((response) => {
            return response.body.statusCode
        })

        console.log(responseStatusCodeList)

        let statusClass;

        console.log(responseStatusCodeList)

        if (responseStatusCodeList.length == 0) {
            statusClass = "idle"
        } else if (responseStatusCodeList.includes(99)) {
            statusClass = "warning"
        } else if (responseStatusCodeList.every(value => value === 0)) {
            statusClass = "ok"
        } else {
            statusClass = "caution"
        }

        return (
            <div className="status-wrapper">
                <div className={"status-summary summary-" + statusClass}>
                    <Status status={statusClass} />
                </div>
                <StatusMessageWrapper
                    currentCommandSet={this.props.currentCommandSet}
                    currentResponseList={this.props.currentResponseList}
                />
            </div>
        )
    }
}

class Status extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        const StatusComponents = {
            ok: <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" fill="#1de46c" viewBox="0 0 200 200"><path d="M113.229,262.6a100,100,0,1,0,100,100,100,100,0,0,0-100-100Zm0,38.83a61.17,61.17,0,1,1-61.17,61.17,61.17,61.17,0,0,1,61.17-61.17Z" transform="translate(-13.229 -262.604)" /></svg>,
            caution: <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" fill="#fffb9d" viewBox="-1 0 2 2"><path d="M 0 0 L -1 2 L 1 2 L 0 0 Z" /></svg>,
            warning: <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" fill="#e10000" viewBox="-2 -2 4 4"><path d="M 0 -1 L -1 -2 L -2 -1 L -1 0 L -2 1 L -1 2 L 0 1 L 1 2 L 2 1 L 1 0 L 2 -1 L 1 -2 L 0 -1 Z" /></svg>,
            idle: <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" fill="#444444" viewBox="-3 -1 6 2"><path d="M -3 -1 L -3 1 L 3 1 L 3 -1 L 3 -1 Z" /></svg>
        }

        return (
            <div>
                {StatusComponents[this.props.status]}
            </div>
        )
    }
}

class StatusMessageWrapper extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            requestIdList: [],
            statusMessageList: [],
        }
    }

    componentWillReceiveProps(nextProps) {
        console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
        console.log(nextProps);
        console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")

        if (!nextProps.currentCommandSet.length && !nextProps.currentResponseList.length) {
            this.setState({
                requestIdList: [],
                statusMessageList: [],
            })
        }

        nextProps.currentCommandSet.forEach((request) => {
            let appendStatusMessage = {
                requestId: request.commandId,
                statusCode: 99,
                statusMessage: "-",
                groupIndex: request.groupIndex,
            }

            if (this.state.requestIdList.includes(request.commandId)) return;
            this.setState({
                requestIdList: [...this.state.requestIdList, request.commandId]
            })
            this.setState({
                statusMessageList: [...this.state.statusMessageList, appendStatusMessage]
            })
        })

        nextProps.currentResponseList.forEach(async (response) => {
            console.log(this.state.statusMessageList)
            await this.setState({
                statusMessageList: this.state.statusMessageList.filter((message) => {
                    return (message.requestId !== response.header.requestId || message.statusMessage !== "-");
                })
            });
            console.log(this.state.statusMessageList)

            let appendStatusMessage = {
                requestId: response.header.requestId,
                statusCode: response.body.statusCode,
                statusMessage: response.body.statusMessage,
                groupIndex: response.header.groupIndex,
            }

            this.setState({
                statusMessageList: [...this.state.statusMessageList, appendStatusMessage]
            })
        })

        return true;
    }

    render() {
        return (
            <div className="status-message-wrapper">
                {
                    // this.props.currentResponseList.map((element) => {
                    //     return (
                    //         <StatusMessage
                    //             className="message-row"
                    //             key={element.commandId}
                    //             labels={element}
                    //         />
                    //     )
                    // })
                    this.state.statusMessageList.map((element) => {
                        console.log(element)
                        return (
                            <StatusMessage
                                className="message-row"
                                key={generateUuid()}
                                labels={element}
                            />
                        )
                    })
                }
            </div>
        )
    }
}

class StatusMessage extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div className="message-row">
                <StatusBadge statusCode={this.props.labels.statusCode} />
                <div className="message-index">{this.props.labels.groupIndex}</div>
                <div className="message-id">{this.props.labels.requestId}</div>
                <div className="message-status-message">{this.props.labels.statusMessage}</div>
            </div>
        )
    }
}

class StatusBadge extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        let statusClass;
        if (this.props.statusCode === 0) {
            statusClass = "status-badge"
        } else if (this.props.statusCode === 99) {
            statusClass = "status-badge badge-warning"
        } else {
            statusClass = "status-badge badge-caution"
        }

        return (
            // <div>
            <div className={statusClass}></div>
            // {/* <div className="status-tips"></div> */}
            // </div>
        )
    }
}

class ModeWrapper extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            isOverview: true,
            isCommand: false,
            isSubmit: false,
        };
    }

    toggleMode = () => {
        this.setState({
            isOverview: !this.state.isOverview,
            isCommand: !this.state.isCommand,
            isSubmit: !this.state.isSubmit,
        });
    };

    render() {
        return (
            <div className="mode-wrapper">
                <ModeButton
                    label="OVERVIEW"
                    setMode={(newMode) => this.props.setMode(newMode)}
                    modeId="Overview"
                    globalMode={this.props.globalMode}
                />
                <ModeButton
                    label="コマンド"
                    setMode={(newMode) => this.props.setMode(newMode)}
                    modeId="Command"
                    globalMode={this.props.globalMode}
                />
                <ModeButton
                    label="グループ登録"
                    setMode={(newMode) => this.props.setMode(newMode)}
                    modeId="Submit"
                    globalMode={this.props.globalMode}
                />
            </div>
        )
    };
};

class ModeButton extends React.Component {
    constructor(props) {
        super(props);
    }

    onClick = () => {
        this.props.setMode(this.props.modeId);
    }

    render() {
        return (
            <div className={"mode-button " + (this.props.modeId == this.props.globalMode ? "is-selected-mode" : "")}
                onClick={this.onClick}
            >
                {this.props.label}
            </div>
        )
    }
};

const root = ReactDOM.createRoot(
    document.getElementById('root')
);
const element = <App />;
root.render(element);