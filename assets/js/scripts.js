const moduleFields = {
    apt:     [
        { name: 'name', type: 'text', label: 'Package Name' },
        { name: 'state', type: 'select', options: [ 'present', 'absent', 'latest' ], label: 'State' },
        { name: 'update_cache', type: 'select', options: [ 'yes', 'no' ], label: 'Update Cache' }
    ],
    service: [
        { name: 'name', type: 'text', label: 'Service Name' },
        { name: 'state', type: 'select', options: [ 'started', 'stopped', 'restarted' ], label: 'State' },
        { name: 'enabled', type: 'select', options: [ 'yes', 'no' ], label: 'Enabled at Boot' }
    ],
    command: [
        { name: 'cmd', type: 'text', label: 'Command' }
    ],
    file:    [
        { name: 'path', type: 'text', label: 'Path' },
        { name: 'state', type: 'select', options: [ 'directory', 'touch', 'absent' ], label: 'State' },
        { name: 'mode', type: 'text', label: 'Mode' },
        { name: 'owner', type: 'text', label: 'Owner' },
        { name: 'group', type: 'text', label: 'Group' }
    ]
};

const repo = 'DevShedLabs/DeployPackages';

const presetCategories = {
    databases:  {
        name: "Databases",
        url:  `https://cdn.jsdelivr.net/gh/${repo}@main/presets-databases.json`
    },
    languages:  {
        name: "Programming Languages",
        url:  `https://cdn.jsdelivr.net/gh/${repo}@main/presets-languages.json`
    },
    webservers: {
        name: "Web Servers",
        url:  `https://cdn.jsdelivr.net/gh/${repo}@main/presets-servers.json`
    }
};

function TaskEditor( { task, index, onUpdate, onRemove } ) {
    const getCurrentModule = () => {
        return Object.keys( task ).find( key => key !== 'name' );
    };

    const updateTaskModule = ( module ) => {
        const defaultParams = module === 'apt'
                              ? { name: '', state: 'present' }
                              : module === 'service'
                                ? { name: '', state: 'started', enabled: 'yes' }
                                : module === 'file'
                                  ? { path: '', state: 'directory' }
                                  : { cmd: '' };

        onUpdate( index, {
            name:       task.name,
            [ module ]: defaultParams
        } );
    };

    const updateTaskParam = ( module, param, value ) => {
        onUpdate( index, {
            ...task,
            [ module ]: {
                ...task[ module ],
                [ param ]: value
            }
        } );
    };

    const currentModule = getCurrentModule();

    return (
        <div className="tasks-container">
            <div className="task-header">
                <input
                    type="text"
                    value={task.name}
                    onChange={( e ) => onUpdate( index, { ...task, name: e.target.value } )}
                    placeholder="Task name"
                />
                <button className="remove-task" onClick={() => onRemove( index )}>
                    Remove
                </button>
            </div>

            <div className="form-group">
                <label>Module:</label>
                <select
                    value={currentModule}
                    onChange={( e ) => updateTaskModule( e.target.value )}
                >
                    {Object.keys( moduleFields ).map( module => (
                        <option key={module} value={module}>
                            {module}
                        </option>
                    ) )}
                </select>
            </div>

            {currentModule && moduleFields[ currentModule ].map( field => (
                <div key={field.name} className="form-group">
                    <label>{field.label}:</label>
                    {field.type === 'select' ? (
                        <select
                            value={task[ currentModule ][ field.name ]}
                            onChange={( e ) => updateTaskParam( currentModule, field.name, e.target.value )}
                        >
                            {field.options.map( option => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ) )}
                        </select>
                    ) : (
                         <input
                             type={field.type}
                             value={task[ currentModule ][ field.name ]}
                             onChange={( e ) => updateTaskParam( currentModule, field.name, e.target.value )}
                         />
                     )}
                </div>
            ) )}
        </div>
    );
}

function AnsibleBuilder() {
    const [ playbookName, setPlaybookName ] = React.useState( 'my-playbook' );
    const [ hosts, setHosts ]               = React.useState( 'all' );
    const [ become, setBecome ]             = React.useState( true );
    const [ tasks, setTasks ]               = React.useState( [] );
    const [ copySuccess, setCopySuccess ]   = React.useState( false );
    const [ presets, setPresets ]           = React.useState( {} );
    const [ loading, setLoading ]           = React.useState( {} );
    const [ errors, setErrors ]             = React.useState( {} );
    const outputRef                         = React.useRef( null );

    React.useEffect( () => {
        // Load all preset categories
        Object.entries( presetCategories ).forEach( ( [ category ] ) => {
            loadPresetCategory( category );
        } );
    }, [] );

    React.useEffect( () => {
        // Highlight syntax whenever the playbook changes
        if ( outputRef.current ) {
            Prism.highlightElement( outputRef.current );
        }
    }, [ tasks, playbookName, hosts, become ] );

    const loadPresetCategory = async ( category ) => {
        setLoading( prev => ( { ...prev, [ category ]: true } ) );
        try {
            const response = await fetch( presetCategories[ category ].url );
            if ( !response.ok ) throw new Error( `HTTP error! status: ${response.status}` );
            const categoryPresets = await response.json();
            setPresets( prev => ( { ...prev, [ category ]: categoryPresets } ) );
        } catch ( error ) {
            console.error( `Error loading ${category} presets:`, error );
            setErrors( prev => ( { ...prev, [ category ]: error.message } ) );
        } finally {
            setLoading( prev => ( { ...prev, [ category ]: false } ) );
        }
    };

    const addTask = ( task = null ) => {
        const newTask = task || {
            name: `task-${tasks.length + 1}`,
            apt:  { name: '', state: 'present' }
        };
        setTasks( [ ...tasks, newTask ] );
    };

    const removeTask = ( index ) => {
        setTasks( tasks.filter( ( _, i ) => i !== index ) );
    };

    const updateTask = ( index, updates ) => {
        const newTasks    = [ ...tasks ];
        newTasks[ index ] = updates;
        setTasks( newTasks );
    };

    const applyPreset = ( preset ) => {
        preset.tasks.forEach( task => {
            const module = Object.keys( task ).find( key => key !== 'name' );
            if ( module ) {
                addTask( {
                    name:       task.name,
                    [ module ]: task[ module ]
                } );
            }
        } );
    };

    const generatePlaybook = () => {
        const playbook = [ {
            name:  playbookName,
            hosts,
            become,
            tasks: tasks.map( task => ( {
                name: task.name,
                ...( Object.keys( task ).filter( key => key !== 'name' ).reduce( ( acc, key ) => ( {
                    ...acc,
                    [ key ]: task[ key ]
                } ), {} ) )
            } ) )
        } ];
        return jsyaml.dump( playbook );
    };

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText( generatePlaybook() );
            setCopySuccess( true );
            setTimeout( () => setCopySuccess( false ), 2000 );
        } catch ( err ) {
            console.error( 'Failed to copy:', err );
        }
    };

    const renderPresetCategory = ( category ) => {
        const categoryData = presets[ category ];
        if ( !categoryData ) return null;

        return (
            <div key={category} className="category-container">
                <div className="category-title">{presetCategories[ category ].name}</div>
                <div className="preset-grid">
                    {Object.entries( categoryData ).map( ( [ key, preset ] ) => (
                        <button
                            key={key}
                            className="preset-btn"
                            onClick={() => applyPreset( preset )}
                        >
                            {preset.name}
                        </button>
                    ) )}
                </div>
            </div>
        );
    };

    return (
        <div>
            <div className="app-container">
                <div className="panel">
                    <h2>Configuration</h2>

                    <div className="form-group">
                        <label>Playbook Name:</label>
                        <input
                            type="text"
                            value={playbookName}
                            onChange={( e ) => setPlaybookName( e.target.value )}
                        />
                    </div>

                    <div className="form-group">
                        <label>Hosts:</label>
                        <input
                            type="text"
                            value={hosts}
                            onChange={( e ) => setHosts( e.target.value )}
                        />
                    </div>

                    <div className="form-group">
                        <label>Become (sudo):</label>
                        <select
                            value={become.toString()}
                            onChange={( e ) => setBecome( e.target.value === 'true' )}
                        >
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                        </select>
                    </div>

                    <div className="preset-container">
                        <h3>Quick Start Templates</h3>
                        {Object.keys( presetCategories ).map( category =>
                            loading[ category ] ? (
                                <div key={category}>Loading {presetCategories[ category ].name}...</div>
                            ) : errors[ category ] ? (
                                <div key={category}>Error
                                    loading {presetCategories[ category ].name}: {errors[ category ]}</div>
                            ) : (
                                    renderPresetCategory( category )
                                )
                        )}
                    </div>

                    <div>
                        <h3>Tasks</h3>
                        <button className="add-task" onClick={() => addTask()}>
                            Add Task
                        </button>

                        {tasks.map( ( task, index ) => (
                            <TaskEditor
                                key={index}
                                task={task}
                                index={index}
                                onUpdate={updateTask}
                                onRemove={removeTask}
                            />
                        ) )}
                    </div>
                </div>

                <div className="panel">
                    <h2>Generated Playbook</h2>
                    <pre>
                            <code ref={outputRef} className="language-yaml">
                                {generatePlaybook()}
                            </code>
                        </pre>
                    <button
                        className="copy-button"
                        onClick={copyToClipboard}
                    >
                        {copySuccess ? 'Copied!' : 'Copy to Clipboard'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Render the app
const root = ReactDOM.createRoot( document.getElementById( 'root' ) );
root.render( <AnsibleBuilder /> );