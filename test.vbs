'option explicit

dim offByOne : offByOne = 3

function startFW(mul)
	dim first : first = 4
	dim offByOne : offByOne = 0
	startFW = first * (mul + offByOne)
end function

sub echo(thing, b)
'	Wscript.Echo thing
'	Wscript.Echo b
end sub

function startSET()
	echo startFW(2) * 2, 5
end function

function recurse()
'	function inner()
'		inner = 1339
'	end function

	'recurse = inner()
'	Wscript.Echo recurse
end function

function test()
'	if 1 = 1 then
'		dim a :' a = 19
'	end if
'	Wscript.Echo a
end function

'Wscript.Echo tjena

test
recurse

'echo hejsan, 1337
startSET

